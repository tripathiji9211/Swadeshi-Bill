import '@testing-library/jest-dom';

// 1. Mock window.matchMedia permanently (not vi.fn so restoreAllMocks does not wipe it)
const createMatchMedia = (query: string = '') => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {}, // deprecated
  removeListener: () => {}, // deprecated
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => createMatchMedia(query),
});

(global as any).matchMedia = window.matchMedia;

// 2. Mock ResizeObserver
class MockResizeObserver {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
}
global.ResizeObserver = MockResizeObserver as any;
(window as any).ResizeObserver = MockResizeObserver as any;

// 3. Mock IntersectionObserver
class MockIntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [0];
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  takeRecords = () => [];
  constructor(public callback?: IntersectionObserverCallback) {}
}
global.IntersectionObserver = MockIntersectionObserver as any;
(window as any).IntersectionObserver = MockIntersectionObserver as any;

// 4. Mock HTMLCanvasElement & WebGL / 2D contexts for Three.js in jsdom
HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  if (contextId === '2d') {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Array(4) }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    };
  }
  if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
    return {
      canvas: {},
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      getExtension: () => null,
      getParameter: () => 0,
      getShaderPrecisionFormat: () => ({
        precision: 1,
        rangeMin: 1,
        rangeMax: 1,
      }),
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      useProgram: () => {},
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      enable: () => {},
      disable: () => {},
      clear: () => {},
      clearColor: () => {},
      viewport: () => {},
    };
  }
  return null;
} as any;

// 5. Mock URL.createObjectURL and revokeObjectURL
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock-url';
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = () => {};
}

// 6. Mock window.scrollTo
window.scrollTo = () => {};
