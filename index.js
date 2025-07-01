const panels = chrome && chrome.devtools && chrome.devtools.panels;
const elementsPanel = panels && panels.elements;

if (elementsPanel) {
  elementsPanel.createSidebarPane('State', sidebar => {
    elementsPanel.onSelectionChanged.addListener(() => sidebar.setExpression(`(${getPanelContents})()`));
  });
}

/**
 * @typedef {{
 *    panelState: object,
 *    previousPanelState: object,
 *    originalState: object
 * }} State
 */

// The function below is executed in the context of the inspected page.
function getPanelContents() {
  if (!$0) return;
  const ng = window.ng;
  let isAngular = false;
  let isAngularJs = false;
  let isAngularIvy = false;

  const state = getPanelContent();

  if (state) {
    exportToWindow(state);
  } else {
    const message = 'Cannot retrieve angular state';
    updateState({originalState: message});
    return message;
  }

  return state.panelState;


  /** @returns {State} */
  function getPanelContent() {
    let _panelContent;
    try {
      if (isAngularContext()) { // Angular 2+
        _panelContent = getAngularContent(ng);
        isAngular = true;
      } else if (isAngularIvyContext()) { // Angular ivy
        _panelContent = getAngularIvyContent();
        isAngularIvy = true;
      } else if (isAngularJsContext()) { // AngularJs
        _panelContent = getAngularJsContent(window.angular);
        isAngularJs = true;
      }
    } catch {
      /* proceed */
    }
    return _panelContent;
  }

  /** @returns {boolean} */
  function isAngularContext() {
    try {
      return !!ng.probe($0);
    } catch {
      return false;
    }
  }

  /** @returns {boolean} */
  function isAngularIvyContext() {
    try {
      return !!ng.getContext($0);
    } catch {
      return false;
    }
  }

  /** @returns {boolean} */
  function isAngularJsContext() {
    try {
      return !!window.angular.element($0).scope()
    } catch {
      return false;
    }
  }

  function parseNgMajorVersion() {
    if (window.getAllAngularRootElements) {
      const rootElements = getAllAngularRootElements();
      if (rootElements && rootElements[0]) {
        const versionString = rootElements[0].getAttribute('ng-version');
        return versionString.split('.')[0];
      }
    } else if (window.angular) {
      return 1;
    }
  }

  /** @returns {State} */
  function getAngularJsContent(angular) {
    const originalState = angular.element($0).scope();
    const panelState = cloneWithObservables(originalState);
    return {panelState, previousPanelState: cloneWithObservables(panelState), originalState};
  }

  /** @returns {State} */
  function getAngularContent(ng) {
    const probe = ng.probe($0);
    const originalState = probe.componentInstance;
    const panelState = cloneWithObservables(originalState);
    addStateProp(panelState, '$context', probe.context);
    addStateProp(panelState, '$debugInfo', probe);

    return {panelState, previousPanelState: cloneWithObservables(panelState), originalState};
  }

  /** @returns {State} */
  function getAngularIvyContent() {
    let el = $0;
    const owningComponent = ng.getOwningComponent(el);
    const originalState = ng.getComponent(el) || owningComponent;
    const panelState = cloneWithObservables(originalState);

    if (owningComponent !== originalState) {
      addStateProp(panelState, '$owningComponent', owningComponent);
    }
    addStateProp(panelState, '$context', ng.getContext(el));
    addStateProp(panelState, '$directives', ng.getDirectives(el));
    addStateProp(panelState, '$listeners', ng.getListeners(el));

    return {panelState, previousPanelState: cloneWithObservables(panelState), originalState};
  }

  /**
   * @param {object} state
   * @param {string} name
   * @param {*} value
   */
  function addStateProp(state, name, value) {
    if (value && Object.keys(value).length) {
      // Properties added with defineProperty are shown in a light red color
      Object.defineProperty(state, name, {value, enumerable: false});
    }
  }

  /**
   * Returns function that runs digest based on angular version.
   * @returns {function(...[*]=)}
   */
  function getDetectChangesFunc() {
    return () => {
      let result = 0x1F44D;
      const state = stateRef();
      try {
        if (isAngularIvy && ng.applyChanges) {
          // Angular 9+
          ng.applyChanges(updateComponentState(state));
        } else if (isAngular) {
          if (state.panelState.$debugInfo._debugInfo) {
            // Angular 2
            updateComponentState(state);
            state.panelState.$debugInfo._debugInfo._view.changeDetectorRef.detectChanges();
          } else if (ng.coreTokens) {
            // Angular 4+
            const ngZone = state.panelState.$debugInfo.injector.get(ng.coreTokens.NgZone);
            ngZone.run(() => {
              updateComponentState(state);
            });
          }
        } else if (isAngularJs && window.angular) {
          updateComponentState(state);
          angular.element($0).scope().$applyAsync();
        } else {
          console.error("Couldn't find change detection api.");
          result = 0x1F44E;
        }
      } catch (e) {
        console.error("Something went wrong. Couldn't run change detection.", e);
        result = 0x1F44E;
      }
      return String.fromCodePoint(result);
    }
  }

  /**
   * Compares previous and current panel state, if something is changed applies it to original state.
   * @param {State} scope
   * @returns {object}
   */
  function updateComponentState(scope) {
    Object.keys(scope.originalState).forEach((prop) => {
      if (scope.previousPanelState[prop] !== scope.panelState[prop]) {
        scope.previousPanelState[prop] = scope.panelState[prop];
        scope.originalState[prop] = scope.panelState[prop];
      }
    })
    return scope.originalState;
  }

  /**
   * Recursively searches the closest $ctrl property in scope.
   * @param {object} scope
   * @returns {string|object}
   */
  function findCtrl(scope) {
    if (scope && scope.$ctrl) {
      return scope.$ctrl;
    } else if (scope && scope.$parent) {
      return findCtrl(scope.$parent);
    } else {
      return '$ctrl is not found. Component or directive with controllerAs might not used in selected scope. ' +
          'See https://docs.angularjs.org/guide/component';
    }
  }

  /** @returns {State} */
  function stateRef() {
    return window.__ngState__;
  }

  /** Updates state reference. */
  function updateState(state) {
    window.__ngState__ = state;
  }

  /** Adds shortcuts to window object and prints help message to console. */
  function exportToWindow() {
    updateState(state);

    if (isAngularJs && !window.$ctrl) {
      Object.defineProperty(window, '$ctrl', {
        get() {
          return findCtrl(stateRef().originalState);
        }
      })
    }

    if (!window.$applyChanges) {
      window.$apply = window.$detectChanges = window.$applyChanges = getDetectChangesFunc();
    }

    if (!window.$state) {
      ['$state', '$scope', '$context'].forEach(method =>
        Object.defineProperty(window, method, {
          get() {
            return stateRef().originalState;
          }
        }));
    }

    if (window.__shortcutsShown__) return;
    console.log('\n\n');
    console.log('%cAngular state inspector shortcuts:', 'color: #ff5252; font-weight: bold;');
    if (isAngularJs) {
      console.log(`%c  $ctrl: %cComponent $ctrl property`, 'color: #ff5252;', 'color: #1976d2');
    }
    console.log(`%c  $state/$scope/$context: %cElement debug info`, 'color: #ff5252;', 'color: #1976d2');
    console.log(
      `%c  $apply/$applyChanges(): %cTrigger change detection cycle`,
      'color: #ff5252', 'color: #1976d2'
    );
    console.log('\n\n');
    window.__shortcutsShown__ = true;
  }

  /**
   * Enhanced clone function that properly handles observables
   * @param {object} object - Object to clone
   * @returns {object} - Cloned object with observable values extracted
   */
  function cloneWithObservables(object) {
    if (!object || typeof object !== 'object') {
      return object;
    }

    const cloned = Object.create(null);
    
    // Get all property names including non-enumerable ones
    const allProps = Object.getOwnPropertyNames(object);
    
    allProps.forEach(prop => {
      try {
        const value = object[prop];
        
        // Check if it's an observable
        if (value && typeof value === 'object' && typeof value.subscribe === 'function') {
          cloned[prop] = extractObservableValue(value, prop);
        } else if (value && typeof value === 'object' && value.constructor !== Object && !Array.isArray(value)) {
          // Handle other complex objects (but not plain objects or arrays)
          cloned[prop] = `[${value.constructor?.name || 'Object'}]`;
        } else if (typeof value === 'function') {
          cloned[prop] = `[Function: ${value.name || 'anonymous'}]`;
        } else {
          cloned[prop] = value;
        }
      } catch (e) {
        cloned[prop] = `[Error: Cannot access property]`;
      }
    });

    return cloned;
  }

  /**
   * Extracts the current value from an observable
   * @param {object} observable - The observable to extract value from
   * @param {string} propName - Property name for debugging
   * @returns {object} - Object containing observable info and current value
   */
  function extractObservableValue(observable, propName) {
    const observableInfo = {
      __type: 'Observable',
      __observableType: observable.constructor?.name || 'Observable',
      __propName: propName
    };

    try {
      // Method 1: Try to subscribe and get the current value
      let currentValue = undefined;
      let hasValue = false;
      let subscriptionError = null;

      try {
        const subscription = observable.subscribe({
          next: (value) => {
            currentValue = value;
            hasValue = true;
          },
          error: (error) => {
            subscriptionError = error.message || 'Subscription error';
          }
        });
        
        // Immediately unsubscribe to avoid side effects
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      } catch (subscribeError) {
        subscriptionError = subscribeError.message || 'Failed to subscribe';
      }

      if (hasValue) {
        observableInfo.__currentValue = currentValue;
        observableInfo.__hasValue = true;
        observableInfo.__accessMethod = 'subscription';
        
        // Also try to stringify for better display
        try {
          observableInfo.__currentValueJSON = JSON.stringify(currentValue, null, 2);
        } catch (e) {
          observableInfo.__currentValueJSON = '[Cannot stringify]';
        }
      } else {
        // Method 2: Fallback to property access for BehaviorSubject/ReplaySubject
        try {
          if (observable.value !== undefined) {
            observableInfo.__currentValue = observable.value;
            observableInfo.__hasValue = true;
            observableInfo.__accessMethod = 'property access';
            observableInfo.__currentValueJSON = JSON.stringify(observable.value, null, 2);
          } else if (observable._value !== undefined) {
            observableInfo.__currentValue = observable._value;
            observableInfo.__hasValue = true;
            observableInfo.__accessMethod = 'private property access';
            observableInfo.__currentValueJSON = JSON.stringify(observable._value, null, 2);
          } else {
            observableInfo.__hasValue = false;
            observableInfo.__note = subscriptionError || 'No current value available (cold observable or empty)';
          }
        } catch (e) {
          observableInfo.__hasValue = false;
          observableInfo.__note = subscriptionError || 'Cannot access observable value';
        }
      }

      // Additional observable metadata
      try {
        if (observable.closed !== undefined) {
          observableInfo.__closed = observable.closed;
        }
        if (observable.observers && observable.observers.length !== undefined) {
          observableInfo.__observerCount = observable.observers.length;
        }
        if (observable.source) {
          observableInfo.__sourceType = observable.source.constructor?.name || 'Unknown';
        }
      } catch (e) {
        // Ignore metadata extraction errors
      }

    } catch (e) {
      observableInfo.__error = e.message || 'Failed to extract observable info';
    }

    return observableInfo;
  }

  // Keep the original clone function as fallback
  function clone(object) {
    return Object.assign(Object.create(null), object);
  }
}
