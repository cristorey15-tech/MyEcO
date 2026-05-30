import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('renders children elements', () => {
    render(<Button><span data-testid="child">Content</span></Button>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  describe('variants', () => {
    it('applies primary variant by default', () => {
      const { container } = render(<Button>Primary</Button>);
      expect(container.firstChild).toHaveClass('bg-primary');
      expect(container.firstChild).toHaveClass('text-white');
    });

    it('applies secondary variant', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);
      expect(container.firstChild).toHaveClass('bg-gray-100');
    });

    it('applies ghost variant', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>);
      expect(container.firstChild).toHaveClass('text-gray-600');
      expect(container.firstChild).toHaveClass('hover:bg-gray-100');
    });

    it('applies danger variant', () => {
      const { container } = render(<Button variant="danger">Danger</Button>);
      expect(container.firstChild).toHaveClass('bg-danger');
      expect(container.firstChild).toHaveClass('text-white');
    });

    it('applies outline variant', () => {
      const { container } = render(<Button variant="outline">Outline</Button>);
      expect(container.firstChild).toHaveClass('border-2');
    });
  });

  describe('sizes', () => {
    it('applies sm size', () => {
      const { container } = render(<Button size="sm">Small</Button>);
      expect(container.firstChild).toHaveClass('px-3');
      expect(container.firstChild).toHaveClass('text-sm');
    });

    it('applies md size by default', () => {
      const { container } = render(<Button>Medium</Button>);
      expect(container.firstChild).toHaveClass('px-4');
      expect(container.firstChild).toHaveClass('py-2.5');
    });

    it('applies lg size', () => {
      const { container } = render(<Button size="lg">Large</Button>);
      expect(container.firstChild).toHaveClass('px-6');
      expect(container.firstChild).toHaveClass('text-base');
    });
  });

  describe('isLoading', () => {
    it('renders a spinner when loading', () => {
      const { container } = render(<Button isLoading>Loading</Button>);
      const spinner = container.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('disables the button when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByText('Loading').closest('button')).toBeDisabled();
    });

    it('still renders children text when loading', () => {
      render(<Button isLoading>Loading text</Button>);
      expect(screen.getByText('Loading text')).toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('applies disabled attribute', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByText('Disabled').closest('button')).toBeDisabled();
    });

    it('can be both disabled and loading', () => {
      render(<Button disabled isLoading>Both</Button>);
      expect(screen.getByText('Both').closest('button')).toBeDisabled();
    });
  });

  describe('click handler', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);
      fireEvent.click(screen.getByText('Click'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Click</Button>);
      fireEvent.click(screen.getByText('Click'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<Button isLoading onClick={handleClick}>Click</Button>);
      fireEvent.click(screen.getByText('Click'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('className', () => {
    it('merges custom className with base styles', () => {
      const { container } = render(<Button className="custom-class">Custom</Button>);
      expect(container.firstChild).toHaveClass('custom-class');
      expect(container.firstChild).toHaveClass('bg-primary'); // base style still present
    });
  });

  describe('button attributes', () => {
    it('passes type attribute', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByText('Submit').closest('button')).toHaveAttribute('type', 'submit');
    });

    it('passes data-* attributes', () => {
      render(<Button data-testid="my-button">Test</Button>);
      expect(screen.getByTestId('my-button')).toBeInTheDocument();
    });
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
  });
});
