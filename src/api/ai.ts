import { fetch } from "@tauri-apps/plugin-http";
import { ApiResponse } from "./http";
import { getStoreValue } from "./store";

// Define the DeepInfra API response type
interface DeepInfraResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const namingStyles = [
  "example-folder-name",
  "example_folder_name",
  "example folder name",
  "Example Folder Name",
  "exampleFolderName",
  "ExampleFolderName",
] as const;

/**
 * Generates a folder structure using DeepInfra's Gemini AI
 */
export async function generateFolderStructure(
  prompt: string
): Promise<ApiResponse<string>> {
  try {
    const apiKey = import.meta.env.VITE_DEEPINFRA_API_KEY;

    if (!apiKey) {
      return {
        error:
          "DEEPINFRA_API_KEY is not configured. Please add it to your environment variables.",
      };
    }

    // Get user's preferred naming style from store
    const savedStyle = await getStoreValue<string>("aiNamingStyle");
    const namingStyle =
      savedStyle &&
      namingStyles.includes(savedStyle as (typeof namingStyles)[number])
        ? savedStyle
        : namingStyles[0];

    const url = "https://api.deepinfra.com/v1/openai/chat/completions";
    const model = "google/gemini-2.0-flash-001";

    // const model = "gpt-4o-mini-2024-07-18";
    // const url = "https://api.openai.com/v1/chat/completions";

    const systemPrompt = `You are a folder structure generator. Your task is to create clean, organized folder structures based on user input.

Please follow these rules strictly:
1. Root folders/files should start at the left margin without indentation
2. Each level of nesting should be indicated by additional tab characters
3. Do not add tailing slashes to files or folders and avoid using unusual characters
4. Focus mostly on folders and subfolders. Unless we're sure a file should go there (index.js, README.md, etc). But don't be too creative on the file side.
5. Each item (file or folder) should be on its own line
6. Do not include any additional explanation, just the folder structure
7. Use this exact naming style for folder and file names: ${namingStyle}
8. Use _ before incrementing numbers in names if needed
9. Try to aim around 10-15 items in the structure and never go over 30
10. Do not create files starting with a dot (.)

Example of desired output format:
root
	folder1
		subfolder
			file.txt
		file1.js
	folder2
		file2.md
	config.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Create a folder structure based on this input: ${prompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data: DeepInfraResponse = await response.json();

    if (data.choices && data.choices.length > 0) {
      console.log(data.choices[0].message.content);
      return { data: data.choices[0].message.content };
    } else {
      return { error: "No response received from DeepInfra API" };
    }
  } catch (error) {
    console.error("AI request failed:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
