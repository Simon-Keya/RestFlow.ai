"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/providers/ToastProvider";
import { useAuthStore } from "@/store/auth";
import { canAccess, canChangeUserRole } from "@/lib/permissions";
import { teamApi } from "../api";
import type { TeamRole } from "../types";
import { ShieldOff, UsersRound } from "lucide-react";

const ALL_ROLES: TeamRole[] = ["ADMIN", "MANAGER", "KITCHEN", "POS"];

export function TeamPage({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const actorRole = useAuthStore((s) => s.user?.role) as TeamRole | undefined;
  const allowedTeam = canAccess("team", actorRole);

  const query = useQuery({
    queryKey: ["team", "users", shopId],
    queryFn: () => teamApi.list(shopId),
    enabled: allowedTeam,
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      teamApi.changeRole(userId, role),
    onSuccess: (res) => {
      toast({
        title: "Role updated",
        description: `${res.message}`,
        variant: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["team", "users", shopId],
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not change role",
        description: err.message,
        variant: "danger",
      });
    },
  });

  if (!allowedTeam) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Team is admin-only"
        description="Only administrators can view staff and change roles."
      />
    );
  }

  /** Michael: only ADMIN may change roles */
  const rolesForActor = (): TeamRole[] => {
    if (actorRole === "ADMIN") return ALL_ROLES;
    return [];
  };

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load team"
        description={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const users = query.data ?? [];
  const allowed = canChangeUserRole(actorRole) ? rolesForActor() : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="Manage staff roles. After a change, the user must log out and log in again."
      />
      <Card>
        {users.length === 0 && !query.isPending ? (
          <EmptyState
            icon={UsersRound}
            title="No users yet"
            description="Register staff accounts, then assign roles here."
          />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Change role</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-ink-muted">{u.email}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>
                    {allowed.length === 0 ? (
                      <span className="text-xs text-ink-faint">—</span>
                    ) : (
                      <select
                        className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
                        value={u.role}
                        disabled={changeRole.isPending}
                        onChange={(e) => {
                          const role = e.target.value as TeamRole;
                          if (role === u.role) return;
                          if (
                            !window.confirm(
                              `Change ${u.email} from ${u.role} to ${role}? They must log in again.`,
                            )
                          ) {
                            e.target.value = u.role;
                            return;
                          }
                          changeRole.mutate({ userId: u.id, role });
                        }}
                      >
                        {!allowed.includes(u.role) ? (
                          <option value={u.role}>{u.role}</option>
                        ) : null}
                        {allowed.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}