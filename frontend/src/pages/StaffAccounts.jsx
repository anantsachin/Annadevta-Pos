import React from "react";
import StaffManager from "../components/StaffManager";
import { Users } from "lucide-react";

export default function StaffAccounts() {
  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-terracotta/10 rounded-lg">
            <Users className="w-6 h-6 text-terracotta" />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Staff Accounts
          </h1>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Manage system access for your restaurant. Create cashier accounts so your staff can securely log in and process orders without accessing admin features like reports or settings.
        </p>
      </div>

      <StaffManager />
    </div>
  );
}
