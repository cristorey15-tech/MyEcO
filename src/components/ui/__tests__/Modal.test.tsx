import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Modal } from '../modal';

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Test">
        Content
      </Modal>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and children when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="My Modal Title">
        <p>Modal body content</p>
      </Modal>
    );
    expect(screen.getByText('My Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('renders footer content when provided', () => {
    render(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Test"
        footer={<button>Save</button>}
      >
        Content
      </Modal>
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('does not render footer section when not provided', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        Content
      </Modal>
    );
    // Without a footer prop, expect no elements with border-t class
    const borderTopDivs = container.querySelectorAll('.border-t');
    expect(borderTopDivs.length).toBe(0);
  });

  describe('close behavior', () => {
    it('calls onClose when clicking the close (X) button', () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={onClose} title="Test">
          Content
        </Modal>
      );
      // Find the button that has an SVG child (the X icon from lucide-react)
      const buttons = screen.getAllByRole('button');
      const xButton = buttons.find(btn => btn.querySelector('svg'));
      expect(xButton).toBeDefined();
      fireEvent.click(xButton!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay backdrop', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={onClose} title="Test">
          Content
        </Modal>
      );
      // Modal structure: wrapper div > [overlay div, panel div]
      const wrapper = container.firstChild as HTMLElement;
      const overlay = wrapper?.firstChild as HTMLElement;
      expect(overlay).toBeDefined();
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when pressing Escape key', () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={onClose} title="Test">
          Content
        </Modal>
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('body overflow', () => {
    it('locks body scroll when open', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test">
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed (isOpen=false)', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}} title="Test">
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={() => {}} title="Test">
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('');
    });

    it('restores body scroll on unmount', () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={() => {}} title="Test">
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('sizes', () => {
    it('applies sm size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} title="Test" size="sm">
          Content
        </Modal>
      );
      const modalPanel = container.querySelector('.max-w-sm');
      expect(modalPanel).toBeInTheDocument();
    });

    it('applies md size by default', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} title="Test">
          Content
        </Modal>
      );
      const modalPanel = container.querySelector('.max-w-lg');
      expect(modalPanel).toBeInTheDocument();
    });

    it('applies lg size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} title="Test" size="lg">
          Content
        </Modal>
      );
      const modalPanel = container.querySelector('.max-w-2xl');
      expect(modalPanel).toBeInTheDocument();
    });
  });

  describe('Escape key handler stability', () => {
    it('updates the event listener when onClose changes', () => {
      const onClose1 = vi.fn();
      const onClose2 = vi.fn();
      const { rerender } = render(
        <Modal isOpen={true} onClose={onClose1} title="Test">
          Content
        </Modal>
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose1).toHaveBeenCalledTimes(1);

      rerender(
        <Modal isOpen={true} onClose={onClose2} title="Test">
          Content
        </Modal>
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose2).toHaveBeenCalledTimes(1);
    });
  });
});
