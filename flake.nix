{
  description = "Development and testing environment for neoWX Material skin";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSupportedSystem = f: nixpkgs.lib.genAttrs supportedSystems (system: f {
        pkgs = import nixpkgs { inherit system; };
      });
    in
    {
      devShells = forEachSupportedSystem ({ pkgs }: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            yarn
            sqlite
            python3
            python3Packages.pytest
            python3Packages.beautifulsoup4
            python3Packages.configobj
            python3Packages.cheetah3
            python3Packages.ephem
          ];
        };
      });
    };
}
