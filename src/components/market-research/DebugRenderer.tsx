
import React, { ReactNode } from 'react';

interface DebugRendererProps {
  children: ReactNode;
  componentName: string;
}

export const DebugRenderer: React.FC<DebugRendererProps> = ({ children, componentName }) => {
  console.log(`🔍 ${componentName} - Rendering children:`, children);
  
  // Check if children contains problematic objects
  const checkChildren = (child: any): boolean => {
    if (child && typeof child === 'object' && !React.isValidElement(child) && !Array.isArray(child)) {
      if (child.channel || child.channelMix || child.trigger || child.description) {
        console.error(`🚨 FOUND PROBLEMATIC OBJECT in ${componentName}:`, child);
        return true;
      }
    }
    return false;
  };

  if (React.Children.count(children) > 0) {
    React.Children.forEach(children, (child, index) => {
      if (checkChildren(child)) {
        console.error(`🚨 Problematic child at index ${index} in ${componentName}`);
      }
    });
  } else {
    checkChildren(children);
  }

  try {
    return <>{children}</>;
  } catch (error) {
    console.error(`🚨 Render error in ${componentName}:`, error);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800 font-medium">Render Error in {componentName}</p>
        <p className="text-red-600 text-sm">{String(error)}</p>
      </div>
    );
  }
};
