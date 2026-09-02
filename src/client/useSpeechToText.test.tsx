/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useSpeechToText } from './useSpeechToText';

class FakeSpeechRecognition {
  lang = '';
  interimResults = false;
  continuous = false;
  onresult: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn(() => {
    this.onend?.();
  });
}

let lastInstance: FakeSpeechRecognition | null = null;

function TestHarness({ onTranscriptChange }: { onTranscriptChange: (t: string) => void }) {
  const { supported, listening, start, stop } = useSpeechToText(onTranscriptChange);
  return (
    <div>
      <p data-testid="supported">{String(supported)}</p>
      <p data-testid="listening">{String(listening)}</p>
      <button onClick={start}>start</button>
      <button onClick={stop}>stop</button>
    </div>
  );
}

describe('useSpeechToText', () => {
  const originalSpeechRecognition = (window as any).SpeechRecognition;
  const originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;

  afterEach(() => {
    (window as any).SpeechRecognition = originalSpeechRecognition;
    (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    lastInstance = null;
  });

  it('reports unsupported when the browser has no SpeechRecognition constructor', () => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;

    render(<TestHarness onTranscriptChange={jest.fn()} />);
    expect(screen.getByTestId('supported')).toHaveTextContent('false');
  });

  it('reports supported and starts listening via the webkit-prefixed constructor', () => {
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = jest.fn(function (this: FakeSpeechRecognition) {
      Object.assign(this, new FakeSpeechRecognition());
      lastInstance = this;
    });

    render(<TestHarness onTranscriptChange={jest.fn()} />);
    expect(screen.getByTestId('supported')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('start'));
    expect(screen.getByTestId('listening')).toHaveTextContent('true');
    expect(lastInstance!.start).toHaveBeenCalled();
  });

  it('reports the full accumulated transcript on each result event', () => {
    (window as any).SpeechRecognition = jest.fn(function (this: FakeSpeechRecognition) {
      Object.assign(this, new FakeSpeechRecognition());
      lastInstance = this;
    });

    const onTranscriptChange = jest.fn();
    render(<TestHarness onTranscriptChange={onTranscriptChange} />);
    fireEvent.click(screen.getByText('start'));

    act(() => {
      lastInstance!.onresult?.({
        results: [[{ transcript: 'because free will ' }], [{ transcript: 'requires real choices' }]],
      });
    });

    expect(onTranscriptChange).toHaveBeenCalledWith('because free will requires real choices');
  });

  it('stops listening when the recognizer ends on its own (e.g. silence timeout)', () => {
    (window as any).SpeechRecognition = jest.fn(function (this: FakeSpeechRecognition) {
      Object.assign(this, new FakeSpeechRecognition());
      lastInstance = this;
    });

    render(<TestHarness onTranscriptChange={jest.fn()} />);
    fireEvent.click(screen.getByText('start'));
    expect(screen.getByTestId('listening')).toHaveTextContent('true');

    act(() => {
      lastInstance!.onend?.();
    });
    expect(screen.getByTestId('listening')).toHaveTextContent('false');
  });

  it('stops listening on a recognition error rather than getting stuck', () => {
    (window as any).SpeechRecognition = jest.fn(function (this: FakeSpeechRecognition) {
      Object.assign(this, new FakeSpeechRecognition());
      lastInstance = this;
    });

    render(<TestHarness onTranscriptChange={jest.fn()} />);
    fireEvent.click(screen.getByText('start'));

    act(() => {
      lastInstance!.onerror?.();
    });
    expect(screen.getByTestId('listening')).toHaveTextContent('false');
  });

  it('calls stop() on the active recognizer when stop is requested', () => {
    (window as any).SpeechRecognition = jest.fn(function (this: FakeSpeechRecognition) {
      Object.assign(this, new FakeSpeechRecognition());
      lastInstance = this;
    });

    render(<TestHarness onTranscriptChange={jest.fn()} />);
    fireEvent.click(screen.getByText('start'));
    fireEvent.click(screen.getByText('stop'));

    expect(lastInstance!.stop).toHaveBeenCalled();
  });
});
