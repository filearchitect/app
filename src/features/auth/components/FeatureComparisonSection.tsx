import React from "react";

interface Feature {
  title: string;
  soon?: boolean;
}

interface FeatureComparisonSectionProps {
  limitedFeatures: Feature[];
  proFeatures: Feature[];
}

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-5 h-5 text-green-500"
  >
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
      clipRule="evenodd"
    />
  </svg>
);

const LimitedIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-5 h-5 text-gray-400"
  >
    <path
      fillRule="evenodd"
      d="M5.965 4.904l9.131 9.131a6.5 6.5 0 00-9.131-9.131zm8.07 10.192L4.904 5.965a6.5 6.5 0 009.131 9.131zM4.343 4.343a8 8 0 1111.314 11.314A8 8 0 014.343 4.343z"
      clipRule="evenodd"
    />
  </svg>
);

export const FeatureComparisonSection: React.FC<
  FeatureComparisonSectionProps
> = ({ limitedFeatures, proFeatures }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Limited Version */}
      <div className="space-y-4 p-4 rounded-lg bg-gray-100 py-6">
        <h3 className="text-lg font-semibold">Limited Version</h3>
        <div className="space-y-4">
          {limitedFeatures.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="mt-1">
                <LimitedIcon />
              </div>
              <div>
                <div className="font-regular text-gray-600">
                  {feature.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pro Features */}
      <div className="space-y-4 p-4 rounded-lg bg-blue-500/10 py-6">
        <h3 className="text-lg font-semibold">Pro Features</h3>
        <div className="space-y-4">
          {proFeatures.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="mt-1">
                <CheckIcon />
              </div>
              <div>
                <div className="font-regular">
                  {feature.title}{" "}
                  {feature.soon && (
                    <span className="text-xs text-gray-500">(Coming soon)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
