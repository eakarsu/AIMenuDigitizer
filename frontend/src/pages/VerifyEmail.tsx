import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (t: string) => {
    try {
      const response = await authApi.verifyEmail(t);
      setStatus('success');
      setMessage(response.data.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Verification failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">Verifying Email...</h2>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">Email Verified!</h2>
              <p className="text-gray-600 mt-2">{message}</p>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">Verification Failed</h2>
              <p className="text-gray-600 mt-2">{message}</p>
            </>
          )}
          <div className="mt-6">
            <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
