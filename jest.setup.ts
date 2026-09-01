import '@testing-library/jest-dom';

// jsdom (unlike Jest's default `node` test environment) doesn't implement the
// Fetch API, so `global.fetch` is undefined there. Tests that need `fetch`
// always stub/mock it themselves (e.g. via `jest.spyOn(global, 'fetch')`),
// but `spyOn` requires the property to already exist. This stub only fills
// that gap for jsdom-environment tests; it's never invoked for real.
if (typeof (global as any).fetch === 'undefined') {
  (global as any).fetch = () => Promise.reject(new Error('fetch is not implemented in this test environment'));
}
