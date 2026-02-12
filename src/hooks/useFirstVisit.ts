import { getStoreValue, setStoreValue } from "@/api/store";
import { useEffect, useState } from "react";

export function useFirstVisit() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkFirstVisit = async () => {
      try {
        const hasVisited = await getStoreValue<boolean>("hasVisitedBefore");

        if (!mounted) return;

        if (!hasVisited) {
          setShowWelcome(true);
          await setStoreValue("hasVisitedBefore", true);
          await setStoreValue("createFunctionalBlankFiles", true);
        }
      } catch (error) {
        console.error("Failed to check first visit status:", error);
      }
    };

    checkFirstVisit();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    showWelcome,
    setShowWelcome,
  };
}
