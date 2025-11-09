/**
 * Utility to clear old localStorage data
 * Run this once to migrate from localStorage to Firebase
 */

export const clearLocalStorage = () => {
  const keysToRemove = [
    'workers',
    'employees', 
    'inquiries',
    'payments',
    'pendingWorks',
    'completedToday',
    'members',
    'attendanceSummary'
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  console.log('✅ localStorage cleared successfully');
};

/**
 * Check if migration is needed
 */
export const needsMigration = (): boolean => {
  const oldKeys = ['workers', 'employees', 'inquiries', 'payments', 'pendingWorks'];
  return oldKeys.some(key => localStorage.getItem(key) !== null);
};

/**
 * Get old data for manual migration (if needed)
 */
export const getOldLocalStorageData = () => {
  return {
    workers: JSON.parse(localStorage.getItem('workers') || '[]'),
    inquiries: JSON.parse(localStorage.getItem('inquiries') || '[]'),
    payments: JSON.parse(localStorage.getItem('payments') || '[]'),
    pendingWorks: JSON.parse(localStorage.getItem('pendingWorks') || '[]'),
  };
};
