import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Cpu, HelpCircle, Settings, User } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

const PreferencesLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const onClose = () => {
    navigate("/");
  };

  const getTitle = () => {
    if (isActive("/preferences/general")) return "General preferences";
    if (isActive("/preferences/account")) return "Account preferences";
    if (isActive("/preferences/ai")) return "AI preferences";
    if (isActive("/preferences/help")) return "Help & support";
    return "Preferences";
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[80vh] p-0">
        <DialogTitle className="sr-only">Preferences</DialogTitle>
        <DialogDescription className="sr-only">
          Application preferences and settings
        </DialogDescription>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-52 border-r bg-muted/30 py-6">
            <nav className="space-y-1 px-4">
              <Button
                variant={
                  isActive("/preferences/general") ? "secondary" : "ghost"
                }
                className="w-full text-left justify-start !p-0"
                asChild
              >
                <Link
                  className="flex items-center gap-2 px-4 py-2 justify-start w-full"
                  to="/preferences/general"
                >
                  <Settings className="h-4 w-4" />
                  General
                </Link>
              </Button>
              <Button
                variant={
                  isActive("/preferences/account") ? "secondary" : "ghost"
                }
                className="w-full text-left justify-start !p-0"
                asChild
              >
                <Link
                  className="flex items-center gap-2 px-4 py-2 justify-start w-full"
                  to="/preferences/account"
                >
                  <User className="h-4 w-4" />
                  Account
                </Link>
              </Button>
              <Button
                variant={isActive("/preferences/ai") ? "secondary" : "ghost"}
                className="w-full text-left justify-start !p-0"
                asChild
              >
                <Link
                  className="flex items-center gap-2 px-4 py-2 justify-start w-full"
                  to="/preferences/ai"
                >
                  <Cpu className="h-4 w-4" />
                  AI
                </Link>
              </Button>
              <Button
                variant={isActive("/preferences/help") ? "secondary" : "ghost"}
                className="w-full text-left justify-start !p-0"
                asChild
              >
                <Link
                  className="flex items-center gap-2 px-4 py-2 justify-start w-full"
                  to="/preferences/help"
                >
                  <HelpCircle className="h-4 w-4" />
                  Help
                </Link>
              </Button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 relative">
            <div className="flex items-center border-b px-8 py-4">
              <h1 className="text-lg font-semibold tracking-tight">
                {getTitle()}
              </h1>
            </div>
            <div className="p-8 overflow-y-auto h-[calc(80vh-73px)] space-y-6">
              <Outlet />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesLayout;
