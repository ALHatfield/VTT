import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Welcome } from './Welcome';

describe('Welcome Component', () => {
  it('renders news section', () => {
    render(<Welcome />);

    expect(screen.getByText('News')).toBeInTheDocument();
  });

  it('renders all news items', () => {
    render(<Welcome />);

    expect(screen.getByText('Welcome to VTT')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your virtual tabletop for playing TTRPGs online/i,
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(
      screen.getByText(/Create or join a campaign to begin/i),
    ).toBeInTheDocument();

    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    expect(
      screen.getByText(/Character sheets, integrated dice rolling/i),
    ).toBeInTheDocument();
  });

  it('renders recent activity section', () => {
    render(<Welcome />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('displays placeholder activity message', () => {
    render(<Welcome />);

    expect(
      screen.getByText(/No recent activity yet/i),
    ).toBeInTheDocument();
  });

  it('renders activity item with dot indicator', () => {
    render(<Welcome />);

    const activityItems = screen.getAllByText(/No recent activity yet/i);
    expect(activityItems).toHaveLength(1);
  });
});
