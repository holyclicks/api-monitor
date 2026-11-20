import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Mail, CheckCircle, ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "../services/monitorService.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-gray-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-2 bg-emerald-600 rounded-lg text-white mb-3">
          <Activity className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          Reset Your Password
        </h1>
        <p className="mt-1 text-xs text-gray-400">
          Enter your account email to receive reset instructions
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-gray-800 border border-gray-700 py-6 px-4 shadow rounded-lg sm:px-8">
          {submitted ? (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex p-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Check your email</h3>
              <p className="text-xs text-gray-300">
                If an account exists for <strong className="text-emerald-400">{email}</strong>, we have dispatched a password reset link.
              </p>
              <div className="pt-4">
                <Link
                  to="/login"
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded inline-block"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-gray-900 border border-gray-700 rounded pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Instructions"}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
