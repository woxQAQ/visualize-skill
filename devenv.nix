{ pkgs, ... }: {
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    pnpm.enable = true;
  };
}
