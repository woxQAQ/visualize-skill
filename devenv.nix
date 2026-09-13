{ pkgs, ... }: {
  packages = [
    (pkgs.python3.withPackages (ps: [ ps.pyyaml ]))
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    pnpm.enable = true;
  };
}
