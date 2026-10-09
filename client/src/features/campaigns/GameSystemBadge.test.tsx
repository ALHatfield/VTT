import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GameSystemBadge } from './GameSystemBadge';

describe('GameSystemBadge', () => {
  it('renders the D&D 5e label', () => {
    render(<GameSystemBadge system="dnd5e" />);

    expect(screen.getByTestId('game-system-badge')).toHaveTextContent('D&D 5e');
  });

  it('renders the Pathfinder 2e label', () => {
    render(<GameSystemBadge system="pf2e" />);

    expect(screen.getByTestId('game-system-badge')).toHaveTextContent('Pathfinder 2e');
  });
});
