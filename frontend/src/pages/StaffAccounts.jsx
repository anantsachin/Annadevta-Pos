import React from "react";
import StaffManager from "../components/StaffManager";

export default function StaffAccounts() {
  return (
    <div className="h-full
    bg-[#FFFDF9]
    rounded-[32px]
    border
    border-[#F4E6D7]
    shadow-lg
    p-8
    flex
    flex-col
    overflow-hidden
  ">
    <div className="h-full flex flex-col">
      <div className="mb-6">
      <div className="text-[15px] uppercase tracking-[0.1em] font-bold bg-gradient-to-r from-[#FF8A3D] to-[#FF6B00] bg-clip-text text-transparent">
        TEAM MANAGEMENT
    </div>

    <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
        Staff Accounts
    </h1>

    <p className="text-slate-500 mt-2 max-w-3xl">
        Manage staff accounts, roles and permissions for your restaurant.
    </p>
      </div>
      <div className="flex-1 min-h-0">
      <StaffManager />
      </div>
    </div>
    </div>
  );
  
}
