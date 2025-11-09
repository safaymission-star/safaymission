import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Clock,
  Users,
  UserPlus,
  Briefcase,
  ClipboardCheck,
  ChevronLeft,
  Menu,
  DollarSign,
  LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Contact Form", url: "/contact-form", icon: FileText },
  { title: "Pending Works", url: "/pending-works", icon: Clock },
  { title: "Membership Members", url: "/membership-members", icon: Users },
  { title: "Completed Works", url: "/completed-works", icon: FileText },
  { title: "Add Employee", url: "/add-employee", icon: UserPlus },
  { title: "All Workers", url: "/all-workers", icon: Briefcase },
  { title: "Employee Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "Expense", url: "/expense", icon: DollarSign },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  // track active item by url so clicking (or routing) highlights correctly
  const [activeGroup, setActiveGroup] = useState(location.pathname);

  useEffect(() => {
    // sync when route changes elsewhere in the app
    setActiveGroup(location.pathname);
  }, [location.pathname]);

  const handleLogout = () => {
    // Clear session storage for secure logout
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("loginTime");
    // Also clear any localStorage items if they exist
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("loginTime");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <>
      <motion.div
        className="fixed left-0 top-0 bottom-0 bg-black border-r border-white/10 flex flex-col overflow-hidden z-40"
        animate={{
          width: isExpanded ? "280px" : "80px",
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      >
      {/* Header with Toggle */}
      <motion.div className="p-4 border-b border-white/10 flex items-center justify-between">
        <AnimatePresence>
          {isExpanded && (
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-xl font-bold text-white flex items-center gap-3"
            >
              <Menu className="h-6 w-6" />
              Safay Portal
            </motion.h1>
          )}
        </AnimatePresence>
        
        <motion.button
          className="p-2 hover:bg-white/10 rounded-lg text-white/80"
          onClick={() => setIsExpanded(!isExpanded)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft className={`h-5 w-5 transition-transform duration-300 ${!isExpanded ? "rotate-180" : ""}`} />
        </motion.button>
      </motion.div>

      {/* Menu Items */}
      <motion.div
        className="flex-1 py-6 px-3 space-y-1 overflow-hidden"
        initial={false}
      >
        {menuItems.map((item, index) => (
          <NavLink
            key={item.url}
            to={item.url}
            end
            className={({ isActive }) => `block relative`}
            onClick={() => setActiveGroup(item.url)}
          >
            {({ isActive }) => {
              const active = isActive || activeGroup === item.url;
              return (
                <motion.div
                  className={`flex items-center gap-4 px-3 py-3 rounded-lg relative overflow-hidden group ${
                    active
                      ? "text-black bg-white font-semibold [&_*]:text-black"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <motion.div
                    className="relative z-10"
                    initial={false}
                    animate={{
                      scale: active ? 1.1 : 1,
                    }}
                  >
                    <item.icon className="h-5 w-5" />
                  </motion.div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        // ensure label sits above the active background
                        className="whitespace-nowrap font-medium relative z-10"
                      >
                        {item.title}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {active && (
                    <motion.div
                      className="absolute inset-0 bg-white z-0"
                      layoutId="activeMenuItem"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </motion.div>
              );
            }}
          </NavLink>
        ))}
      </motion.div>

      {/* Logout Button */}
      <motion.div className="p-3 border-t border-white/10">
        <motion.button
          onClick={handleLogout}
          className="flex items-center gap-4 px-3 py-3 rounded-lg w-full text-white/90 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          whileHover={{ x: 4 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <LogOut className="h-5 w-5" />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="whitespace-nowrap font-medium"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>
      </motion.div>

      {/* Spacer to keep main content pushed right by the sidebar width */}
      <div
        aria-hidden
        style={{ width: isExpanded ? "280px" : "80px" }}
        className="flex-shrink-0 h-screen"
      />
    </>
  );
}
