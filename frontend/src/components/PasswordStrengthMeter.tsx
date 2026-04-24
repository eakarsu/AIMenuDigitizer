interface Props {
  password: string;
}

export default function PasswordStrengthMeter({ password }: Props) {
  const checks = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Lowercase', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special char', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];

  const strength = checks.filter(c => c.met).length;
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < strength ? colors[strength - 1] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${strength >= 4 ? 'text-green-600' : strength >= 3 ? 'text-lime-600' : 'text-orange-600'}`}>
          {labels[strength - 1] || 'Too Short'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map(check => (
          <span
            key={check.label}
            className={`text-xs px-2 py-0.5 rounded-full ${
              check.met ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {check.met ? '✓' : '○'} {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}
