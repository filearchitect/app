import { getStoreValue, setStoreValue } from "@/api/store";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const namingStyles = [
  "example-folder-name",
  "example_folder_name",
  "example folder name",
  "Example Folder Name",
  "exampleFolderName",
  "ExampleFolderName",
] as const;

const AIPreferences: React.FC = () => {
  const [namingStyle, setNamingStyle] = useState<(typeof namingStyles)[number]>(
    namingStyles[0]
  );

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedNamingStyle = await getStoreValue<string>("aiNamingStyle");
        if (
          savedNamingStyle &&
          namingStyles.includes(
            savedNamingStyle as (typeof namingStyles)[number]
          )
        ) {
          setNamingStyle(savedNamingStyle as (typeof namingStyles)[number]);
        }
      } catch (error) {
        console.error("Error loading AI preferences:", error);
        toast.error("Failed to load AI preferences");
      }
    };

    loadPreferences();
  }, []);

  const handleNamingStyleChange = async (value: string) => {
    try {
      setNamingStyle(value as (typeof namingStyles)[number]);
      await setStoreValue("aiNamingStyle", value);
      toast.success("Naming style preference saved");
    } catch (error) {
      console.error("Failed to save naming style preference:", error);
      toast.error("Failed to save preference");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium block mb-3">
                File and Folder Naming Style
              </Label>
              <p className="text-sm text-muted-foreground mb-4">
                Choose how AI should format names when generating file and
                folder structures.
              </p>

              <RadioGroup
                value={namingStyle}
                onValueChange={handleNamingStyleChange}
                className="space-y-4 pt-4"
              >
                {namingStyles.map((style) => (
                  <div key={style} className="flex items-center space-x-2">
                    <RadioGroupItem value={style} id={style} />
                    <Label
                      htmlFor={style}
                      className="font-normal cursor-pointer"
                    >
                      {style}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AIPreferences;
