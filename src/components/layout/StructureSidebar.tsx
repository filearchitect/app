import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { useStructures } from "@/features/structures/StructureContext";
import StructureManager from "@/features/structures/StructureManager";
import { cn } from "@/lib/utils";
import { ArrowUpCircle, Settings, Zap } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

const MENU_ITEMS = [
  {
    title: "Preferences",
    icon: Settings,
    path: "/preferences/general",
  },
];

const StructureSidebar: React.FC = () => {
  const isLocalEnv = import.meta.env.VITE_APP_ENV === "local";
  const { license } = useAuthContext();
  const { activeStructure, exitStructureEditing } = useStructures();

  const isQuickStructureActive = !activeStructure;

  const handleQuickStructureClick = () => {
    if (activeStructure) {
      exitStructureEditing();
    }
  };

  return (
    <Sidebar className="h-full flex flex-col">
      <SidebarContent className="flex-1 flex flex-col">
        {/* Quick Structure - always at the top */}
        <SidebarGroup data-tauri-drag-region className="pt-12">
          <SidebarGroupContent>
            <ul className="p-1">
              <li
                onClick={handleQuickStructureClick}
                className={cn(
                  "rounded-md ease-in-out flex items-center space-x-2 p-2 h-9 transition-all cursor-pointer",
                  isQuickStructureActive
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-gray-100 hover:text-gray-600"
                )}
              >
                <Zap
                  className={cn(
                    "size-4",
                    isQuickStructureActive ? "text-blue-500" : "text-gray-400"
                  )}
                />
                <span className="font-medium text-sm">Quick structure</span>
              </li>
            </ul>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup data-tauri-drag-region className="flex-1">
          <SidebarGroupLabel className="uppercase">
            Saved structures
          </SidebarGroupLabel>
          <SidebarGroupContent className="flex-1" data-tauri-drag-region>
            <StructureManager />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup data-tauri-drag-region>
          <SidebarGroupContent>
            <SidebarMenu>
              {license?.type === "trial" && (
                <SidebarMenuItem>
                  <Link to="/preferences/account">
                    <SidebarMenuButton className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg py-5 mb-4">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="mr-2" size={20} />
                        <span className="font-medium">
                          Unlock File Architect
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
              {MENU_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Link to={item.path}>
                    <SidebarMenuButton>
                      <item.icon className="mr-2" size={20} />
                      {isLocalEnv && (
                        <div className="bg-red-500 text-white rounded-full px-2 py-1 text-xs absolute top-0 right-0">
                          Local
                        </div>
                      )}
                      <div>{item.title}</div>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default StructureSidebar;
