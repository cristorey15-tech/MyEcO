export const quickAddItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const quickAddItemTransition = { duration: 0.25, ease: 'easeOut' as const };

export const pagBtnTransition = { duration: 0.2, ease: 'easeOut' as const };

export const pagContainerVariants = {
  visible: { transition: { staggerChildren: 0.04 } },
  hidden: {},
};

export const pagChevronLeftVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0 },
};

export const pagPageBtnVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

export const pagChevronRightVariants = {
  hidden: { opacity: 0, x: 6 },
  visible: { opacity: 1, x: 0 },
};
