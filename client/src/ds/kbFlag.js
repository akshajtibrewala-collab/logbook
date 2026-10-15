// The one place that knows how "keyboard open" is represented in the DOM, so glass.js, hooks.js and Nav.jsx can pause themselves
// without importing the controller (which imports them). The state itself comes from lib/keyboardState.js via ds/keyboard.js.
export const KB_CLASS = 'kb-open';
export const isKeyboardOpen = () => typeof document !== 'undefined' && document.documentElement.classList.contains(KB_CLASS);
