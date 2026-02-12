import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { openLink } from "@/lib/utils";

const HelpPreferences: React.FC = () => {
  return (
    <div className="flex flex-col gap-8">
      <Card variant="bottom-border">
        <div className="flex justify-between items-start p-6 ">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Online Documentation</h4>
            <p className="text-sm text-muted-foreground">
              Access our comprehensive documentation and guides.
            </p>
          </div>
          <Button onClick={() => openLink("https://filearchitect.com/docs")}>
            View Documentation
          </Button>
        </div>
      </Card>

      <Card variant="bottom-border">
        <div className="flex justify-between items-start p-6 pt-0">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Report an issue or suggest a feature
            </h4>
            <p className="text-sm text-muted-foreground">
              Use the form below to report an issue or suggest a feature.
            </p>
          </div>
          <Button onClick={() => openLink("https://filearchitect.userjot.com")}>
            Open support
          </Button>
        </div>
      </Card>

      <Card variant="bottom-border">
        <div className="flex justify-between items-start p-6 pt-0">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Contact Support</h4>
            <p className="text-sm text-muted-foreground">
              Send us an email directly for personalized support.
            </p>
          </div>
          <Button onClick={() => openLink("mailto:support@filearchitect.com")}>
            Send Email
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default HelpPreferences;
