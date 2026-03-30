import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class EventSourceMock {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
  }

  close() {}
}

global.ResizeObserver = ResizeObserverMock;
global.EventSource = EventSourceMock;
global.crypto = {
  randomUUID: jest.fn(() => "test-task-id"),
};
