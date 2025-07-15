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
    const panelState = organizeAngularJsComponent(originalState);
    return {panelState, previousPanelState: cloneWithObservables(panelState), originalState};
  }

  /** @returns {State} */
  function getAngularContent(ng) {
    const probe = ng.probe($0);
    const originalState = probe.componentInstance;
    const panelState = organizeAngularComponent(originalState, probe);
    
    return {panelState, previousPanelState: cloneWithObservables(panelState), originalState};
  }

  /** @returns {State} */
  function getAngularIvyContent() {
    let el = $0;
    const owningComponent = ng.getOwningComponent(el);
    const originalState = ng.getComponent(el) || owningComponent;
    const context = ng.getContext(el);
    const directives = ng.getDirectives(el);
    const listeners = ng.getListeners(el);
    
    const panelState = organizeAngularIvyComponent(originalState, {
      owningComponent,
      context,
      directives,
      listeners
    });

    return {panelState, previousPanelState: cloneWithObservables(panelState), originalState};
  }

  /**
   * Organizes Angular Ivy component data into structured sections
   * @param {object} component - Component instance
   * @param {object} metadata - Additional metadata
   * @returns {object} - Organized component data
   */
  function organizeAngularIvyComponent(component, metadata) {
    const organized = {
      '📋 Component Info': {
        name: component?.constructor?.name || 'Unknown',
        type: 'Angular Component (Ivy)',
        element: $0.tagName?.toLowerCase()
      },
      '📥 Inputs': {},
      '📤 Outputs': {},
      '🔧 Properties': {},
      '📊 Observables': {},
      '🎯 Methods': {},
      '🔍 Debug Info': {}
    };

    if (component) {
      const componentProps = getAllProperties(component);
      categorizeProperties(componentProps, component, organized);
    }

    // Add debug information
    if (metadata.context) {
      organized['🔍 Debug Info']['$context'] = cloneWithObservables(metadata.context);
    }
    if (metadata.directives && metadata.directives.length > 0) {
      organized['🔍 Debug Info']['$directives'] = metadata.directives.map(d => d.constructor?.name || 'Unknown');
    }
    if (metadata.listeners && Object.keys(metadata.listeners).length > 0) {
      organized['🔍 Debug Info']['$listeners'] = Object.keys(metadata.listeners);
    }
    if (metadata.owningComponent && metadata.owningComponent !== component) {
      organized['🔍 Debug Info']['$owningComponent'] = metadata.owningComponent.constructor?.name || 'Unknown';
    }

    return organized;
  }

  /**
   * Organizes Angular 2+ component data into structured sections
   * @param {object} component - Component instance
   * @param {object} probe - Angular probe object
   * @returns {object} - Organized component data
   */
  function organizeAngularComponent(component, probe) {
    const organized = {
      '📋 Component Info': {
        name: component?.constructor?.name || 'Unknown',
        type: 'Angular Component',
        element: $0.tagName?.toLowerCase()
      },
      '📥 Inputs': {},
      '📤 Outputs': {},
      '🔧 Properties': {},
      '📊 Observables': {},
      '🎯 Methods': {},
      '🔍 Debug Info': {}
    };

    if (component) {
      const componentProps = getAllProperties(component);
      categorizeProperties(componentProps, component, organized);
    }

    // Add debug information
    if (probe.context) {
      organized['🔍 Debug Info']['$context'] = cloneWithObservables(probe.context);
    }
    organized['🔍 Debug Info']['$debugInfo'] = {
      componentInstance: component?.constructor?.name || 'Unknown',
      hasInjector: !!probe.injector,
      hasChangeDetector: !!(probe._debugInfo || probe.changeDetectorRef)
    };

    return organized;
  }

  /**
   * Organizes AngularJS component data into structured sections
   * @param {object} scope - AngularJS scope
   * @returns {object} - Organized scope data
   */
  function organizeAngularJsComponent(scope) {
    const organized = {
      '📋 Component Info': {
        name: 'AngularJS Scope',
        type: 'AngularJS',
        element: $0.tagName?.toLowerCase(),
        scopeId: scope.$id
      },
      '🔧 Scope Properties': {},
      '📊 Observables': {},
      '🎯 Methods': {},
      '🔍 Debug Info': {}
    };

    if (scope) {
      const scopeProps = getAllProperties(scope);
      categorizeAngularJsProperties(scopeProps, scope, organized);
    }

    // Add AngularJS specific debug info
    organized['🔍 Debug Info'] = {
      $id: scope.$id,
      $parent: !!scope.$parent,
      $root: scope === scope.$root,
      watchers: scope.$$watchers?.length || 0,
      childScopes: scope.$$childHead ? 'Yes' : 'No'
    };

    return organized;
  }

  /**
   * Categorizes AngularJS properties
   * @param {string[]} props - Property names
   * @param {object} scope - AngularJS scope
   * @param {object} organized - Organized data structure
   */
  function categorizeAngularJsProperties(props, scope, organized) {
    props.forEach(prop => {
      if (prop.startsWith('$') || prop.startsWith('_')) {
        return; // Skip Angular internal properties
      }

      try {
        const value = scope[prop];
        
        if (typeof value === 'function') {
          organized['🎯 Methods'][prop] = `[Function: ${value.name || 'anonymous'}]`;
        } else if (isObservable(value)) {
          organized['📊 Observables'][prop] = extractObservableValue(value, prop);
        } else {
          organized['🔧 Scope Properties'][prop] = cloneWithObservables(value);
        }
      } catch (e) {
        organized['🔧 Scope Properties'][prop] = `[Error: Cannot access property]`;
      }
    });
  }

  /**
   * Categorizes Angular component properties into inputs, outputs, properties, etc.
   * @param {string[]} props - Property names
   * @param {object} component - Component instance
   * @param {object} organized - Organized data structure
   */
  function categorizeProperties(props, component, organized) {
    props.forEach(prop => {
      if (prop.startsWith('_') || prop === 'constructor') {
        return; // Skip private and constructor
      }

      try {
        const value = component[prop];
        const category = determinePropertyCategory(prop, value, component);
        
        if (category === 'method') {
          organized['🎯 Methods'][prop] = `[Function: ${value.name || 'anonymous'}]`;
        } else if (category === 'observable') {
          organized['📊 Observables'][prop] = extractObservableValue(value, prop);
        } else if (category === 'input') {
          organized['📥 Inputs'][prop] = cloneWithObservables(value);
        } else if (category === 'output') {
          organized['📤 Outputs'][prop] = formatEventEmitter(value);
        } else {
          organized['🔧 Properties'][prop] = cloneWithObservables(value);
        }
      } catch (e) {
        organized['🔧 Properties'][prop] = `[Error: Cannot access property]`;
      }
    });
  }

  /**
   * Determines the category of a property
   * @param {string} prop - Property name
   * @param {any} value - Property value
   * @param {object} component - Component instance
   * @returns {string} - Category name
   */
  function determinePropertyCategory(prop, value, component) {
    if (typeof value === 'function') {
      return 'method';
    }

    if (isObservable(value)) {
      return 'observable';
    }

    if (isEventEmitter(value)) {
      return 'output';
    }

    // Check if it's an input by looking at common patterns
    if (isLikelyInput(prop, value, component)) {
      return 'input';
    }

    return 'property';
  }

  /**
   * Checks if a property is likely an input
   * @param {string} prop - Property name
   * @param {any} value - Property value
   * @param {object} component - Component instance
   * @returns {boolean}
   */
  function isLikelyInput(prop, value, component) {
    // Check if the property has a corresponding setter
    const descriptor = Object.getOwnPropertyDescriptor(component, prop) || 
                      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(component), prop);
    
    if (descriptor && descriptor.set) {
      return true;
    }

    // Check for common input naming patterns
    const inputPatterns = [
      /^(data|config|options|settings|props)/i,
      /^(is|has|can|should|will|enable|disable)/i,
      /^(show|hide|visible|hidden)/i
    ];

    return inputPatterns.some(pattern => pattern.test(prop));
  }

  /**
   * Checks if a value is an Observable
   * @param {any} value - Value to check
   * @returns {boolean}
   */
  function isObservable(value) {
    return value && typeof value === 'object' && typeof value.subscribe === 'function';
  }

  /**
   * Checks if a value is an EventEmitter
   * @param {any} value - Value to check
   * @returns {boolean}
   */
  function isEventEmitter(value) {
    return value && typeof value === 'object' && 
           typeof value.subscribe === 'function' && 
           typeof value.emit === 'function';
  }

  /**
   * Formats EventEmitter for display
   * @param {object} emitter - EventEmitter instance
   * @returns {object}
   */
  function formatEventEmitter(emitter) {
    return {
      __type: 'EventEmitter',
      __observerCount: emitter.observers?.length || 0,
      __closed: emitter.closed || false,
      __hasEmitMethod: typeof emitter.emit === 'function'
    };
  }

  /**
   * Gets all property names from an object and its prototype chain
   * @param {object} obj - Object to inspect
   * @returns {string[]} - Array of property names
   */
  function getAllProperties(obj) {
    const props = new Set();
    let current = obj;
    
    while (current && current !== Object.prototype) {
      Object.getOwnPropertyNames(current).forEach(prop => props.add(prop));
      current = Object.getPrototypeOf(current);
    }
    
    return Array.from(props);
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
    console.log('%cAngular State Inspector shortcuts:', 'color: #ff5252; font-weight: bold;');
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
      } else {
        // Method 2: Fallback to property access for BehaviorSubject/ReplaySubject
        try {
          if (observable.value !== undefined) {
            observableInfo.__currentValue = observable.value;
            observableInfo.__hasValue = true;
            observableInfo.__accessMethod = 'property access';
          } else if (observable._value !== undefined) {
            observableInfo.__currentValue = observable._value;
            observableInfo.__hasValue = true;
            observableInfo.__accessMethod = 'private property access';
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
