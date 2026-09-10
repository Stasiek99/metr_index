// jsdom (the test DOM environment) has no ResizeObserver — ngx-echarts' [autoResize]
// (default true) needs one to watch the chart container, so unit tests polyfill it
// with a no-op instead of disabling the real autoResize behavior in production.
/* eslint-disable @typescript-eslint/no-empty-function -- intentional no-op polyfill */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
/* eslint-enable @typescript-eslint/no-empty-function */

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
