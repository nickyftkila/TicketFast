'use client';

import SupportDashboard from '@/components/dashboard/SupportDashboard';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function TicketsPage() {
  return (
    <ProtectedRoute requiredRole="support">
      <SupportDashboard />
    </ProtectedRoute>
  );
}
