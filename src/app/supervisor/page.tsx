'use client';

import SupervisorDashboard from '@/components/dashboard/SupervisorDashboard';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function SupervisorPage() {
  return (
    <ProtectedRoute requiredRole="supervisor">
      <SupervisorDashboard />
    </ProtectedRoute>
  );
}

