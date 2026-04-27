import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import type { Role } from '@/lib/permissions';

interface RequireRoleProps {
  roles: Role[];
  children: React.ReactNode;
  fallback?: string;
}

export function RequireRole({ roles, children, fallback = '/admin' }: RequireRoleProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || !roles.includes(user.role as Role))) {
      navigate(fallback);
    }
  }, [isLoading, user, roles, fallback]);

  if (isLoading || !user) return null;
  if (!roles.includes(user.role as Role)) return null;

  return <>{children}</>;
}
