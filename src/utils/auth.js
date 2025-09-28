export const changePassword = async (data) => {
  try {
    const response = await fetch('/api/users/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Password change failed:', error);
    throw new Error('שגיאה בשינוי הסיסמה. אנא נסה שוב.');
  }
};

export const validatePassword = (password) => {
  const errors = [];
  if (password.length < 6) errors.push('הסיסמה חייבת להיות לפחות 6 תווים');
  if (!/[a-zA-Z]/.test(password)) errors.push('הסיסמה חייבת לכלול לפחות אות אחת');
  if (!/[0-9]/.test(password)) errors.push('הסיסמה חייבת לכלול לפחות ספרה אחת');
  return { isValid: errors.length === 0, errors };
};

export const getPasswordStrength = (password) => {
  if (password.length < 6) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score >= 4) return 'strong';
  if (score >= 2) return 'medium';
  return 'weak';
};


