/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnswerTile } from './AnswerTile';

describe('AnswerTile', () => {
  it('renders as a plain div (not clickable) when not interactive, e.g. on the host', () => {
    render(<AnswerTile position={0} label="C.S. Lewis" size="host" />);
    expect(screen.getByText('C.S. Lewis')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fires onClick when tapped as an interactive player tile', () => {
    const onClick = jest.fn();
    render(
      <AnswerTile position={1} label="Tolkien" size="player" interactive onClick={onClick} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Tolkien/ }));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows a checkmark on the selected tile once locked, and disables the others', () => {
    const onClick = jest.fn();
    render(
      <div>
        <AnswerTile position={0} label="A" size="player" interactive selected locked onClick={onClick} />
        <AnswerTile position={1} label="B" size="player" interactive locked onClick={onClick} />
      </div>
    );

    const selectedTile = screen.getByRole('button', { name: /A/ });
    const otherTile = screen.getByRole('button', { name: /B/ });

    expect(selectedTile).not.toBeDisabled();
    expect(otherTile).toBeDisabled();

    fireEvent.click(otherTile);
    expect(onClick).not.toHaveBeenCalled();
  });
});
