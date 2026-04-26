declare module "swagger-ui-react" {
  import { ComponentType } from "react";

  interface SwaggerUIProps {
    spec?: object;
    url?: string;
    docExpansion?: "list" | "full" | "none";
    defaultModelsExpandDepth?: number;
    displayRequestDuration?: boolean;
    filter?: boolean | string;
    tryItOutEnabled?: boolean;
    requestInterceptor?: (req: object) => object;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}
