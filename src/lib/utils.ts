import { twMerge } from "tailwind-merge";
import { type ClassValue, clsx } from "clsx";

import folder from "material-icon-theme/icons/folder.svg";
import folderOpen from "material-icon-theme/icons/folder-open.svg";
import publicFolder from "material-icon-theme/icons/folder-public.svg";
import publicFolderOpen from "material-icon-theme/icons/folder-public-open.svg";
import src from "material-icon-theme/icons/folder-src.svg";
import srcOpen from "material-icon-theme/icons/folder-src-open.svg";
import node_modules from "material-icon-theme/icons/folder-node.svg";
import node_modulesOpen from "material-icon-theme/icons/folder-node-open.svg";
import components from "material-icon-theme/icons/folder-components.svg";
import componentsOpen from "material-icon-theme/icons/folder-components-open.svg";
import ui from "material-icon-theme/icons/folder-ui.svg";
import uiOpen from "material-icon-theme/icons/folder-ui-open.svg";
import hooks from "material-icon-theme/icons/folder-hook.svg";
import hooksOpen from "material-icon-theme/icons/folder-hook-open.svg";
import lib from "material-icon-theme/icons/folder-lib.svg";
import libOpen from "material-icon-theme/icons/folder-lib-open.svg";
import styles from "material-icon-theme/icons/folder-css.svg";
import stylesOpen from "material-icon-theme/icons/folder-css-open.svg";
import dist from "material-icon-theme/icons/folder-dist.svg";
import distOpen from "material-icon-theme/icons/folder-dist-open.svg";
import prisma from "material-icon-theme/icons/folder-prisma.svg";
import prismaOpen from "material-icon-theme/icons/folder-prisma-open.svg";
import controller from "material-icon-theme/icons/folder-controller.svg";
import controllerOpen from "material-icon-theme/icons/folder-controller-open.svg";
import routes from "material-icon-theme/icons/folder-routes.svg";
import routesOpen from "material-icon-theme/icons/folder-routes-open.svg";
import tests from "material-icon-theme/icons/folder-test.svg";
import testsOpen from "material-icon-theme/icons/folder-test-open.svg";

import file from "material-icon-theme/icons/file.svg";
import txt from "material-icon-theme/icons/document.svg";
import js from "material-icon-theme/icons/javascript.svg";
import jsx from "material-icon-theme/icons/react.svg";
import ts from "material-icon-theme/icons/typescript.svg";
import html from "material-icon-theme/icons/html.svg";
import css from "material-icon-theme/icons/css.svg";
import json from "material-icon-theme/icons/json.svg";
import md from "material-icon-theme/icons/markdown.svg";
import git from "material-icon-theme/icons/git.svg";
import gitignore from "material-icon-theme/icons/git.svg";
import docker from "material-icon-theme/icons/docker.svg";
import npm from "material-icon-theme/icons/npm.svg";
import yarn from "material-icon-theme/icons/yarn.svg";
import env from "material-icon-theme/icons/tune.svg";
import tsx from "material-icon-theme/icons/react_ts.svg";
import c from "material-icon-theme/icons/c.svg";
import cpp from "material-icon-theme/icons/cpp.svg";
import rs from "material-icon-theme/icons/rust.svg";
import java from "material-icon-theme/icons/java.svg";
import py from "material-icon-theme/icons/python.svg";
import package_json from "material-icon-theme/icons/nodejs.svg";
import vite_config_ts from "material-icon-theme/icons/vite.svg";
import test_ts from "material-icon-theme/icons/test-ts.svg";
import test_js from "material-icon-theme/icons/test-js.svg";
import test_tsx from "material-icon-theme/icons/test-jsx.svg";
import test_jsx from "material-icon-theme/icons/test-jsx.svg";
import tsconfig_json from "material-icon-theme/icons/tsconfig.svg";
import http from "material-icon-theme/icons/http.svg";
import tailwindcss from "material-icon-theme/icons/tailwindcss.svg";
import postcss from "material-icon-theme/icons/postcss.svg";
import svg from "material-icon-theme/icons/svg.svg";
import image from "material-icon-theme/icons/image.svg";
import {
  type ManifestConfig,
  type IconAssociations,
  type IconPackValue,
  generateManifest,
} from "material-icon-theme";
import { TreeNode } from "../constants";
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

const FolderIcons: { [key: string]: string } = {
  folder,
  folderOpen,
  public: publicFolder,
  publicOpen: publicFolderOpen,
  src,
  srcOpen,
  node_modules,
  node_modulesOpen,
  components,
  componentsOpen,
  ui,
  uiOpen,
  hooks,
  hooksOpen,
  lib,
  libOpen,
  styles,
  stylesOpen,
  dist,
  distOpen,
  prisma,
  prismaOpen,
  controller,
  controllerOpen,
  routes,
  routesOpen,
  tests,
  testsOpen,
} as const;

const FileIcons: { [key: string]: string } = {
  file,
  svg,
  jpg: image,
  jpeg: image,
  png: image,
  txt,
  js,
  jsx,
  ts,
  tsx,
  html,
  css,
  json,
  md,
  git,
  gitignore,
  docker,
  npm,
  yarn,
  env,
  c,
  cpp,
  rs,
  java,
  py,
  http,
  rest: http,
  "package.json": package_json,
  "package-lock.json": package_json,
  "vite.config.ts": vite_config_ts,
  "test.ts": test_ts,
  "test.js": test_js,
  "test.tsx": test_tsx,
  "test.jsx": test_jsx,
  "tsconfig.json": tsconfig_json,
  "tsconfig.app.json": tsconfig_json,
  "tsconfig.node.json": tsconfig_json,
  "tailwind.config.js": tailwindcss,
  "tailwind.config.ts": tailwindcss,
  "postcss.config.js": postcss,
  "postcss.config.ts": postcss,
} as const;

export const getFileIcon = (name: string) => {
  if (FileIcons[name]) {
    return FileIcons[name];
  }
  const fileSplit = name.split(".");
  if (fileSplit.length > 2) {
    fileSplit.shift();
    return (
      FileIcons[fileSplit.join(".")] ||
      FileIcons[fileSplit.pop()!] ||
      FileIcons["file"]
    );
  } else {
    return FileIcons[fileSplit.pop()!] || FileIcons["file"];
  }
};

export const getFolderIcon = (folderName: string) => {
  if (FolderIcons[folderName]) {
    return {
      icon: FolderIcons[folderName],
      openIcon: FolderIcons[`${folderName}Open`],
    };
  }
  return { icon: FolderIcons["folder"], openIcon: FolderIcons["folderOpen"] };
};

const tree: TreeNode[] = [
  {
    type: "folder",
    name: "client",
    path: "client",
    children: [
      {
        type: "folder",
        name: "public",
        path: "client/public",
        children: [
          {
            type: "file",
            name: "favicon.ico",
            path: "client/public/favicon.ico",
          },
          {
            type: "file",
            name: "index.html",
            path: "client/public/index.html",
          },
        ],
      },
      {
        type: "folder",
        name: "src",
        path: "client/src",
        children: [
          {
            type: "folder",
            name: "components",
            path: "client/src/components",
            children: [
              {
                type: "file",
                name: "TreeFile.tsx",
                path: "client/src/components/TreeFile.tsx",
              },
              {
                type: "file",
                name: "TreeFolder.tsx",
                path: "client/src/components/TreeFolder.tsx",
              },
            ],
          },
        ],
      },
    ],
  },
];

export const findNode = (nodes: TreeNode[], path: string): TreeNode | null => {
  let foundNode = null;
  for (const node of nodes) {
    if (node.path === path) {
      foundNode = node;
      break;
    }
    if (path.startsWith(node.path)) {
      if (node.type === "folder" && node.children) {
        return findNode(node.children, path);
      }
    }
  }
  return foundNode;
};

// console.log(findNode(tree, "client/src/components"));

export const updatePath = (node: TreeNode, newPath: string) => {
  if (node.type === "file" || (node.type === "folder" && !node.children)) {
    node.path = newPath;
    return;
  }
  // @ts-ignore
  node.children.forEach((child) => {
    if (child.type === "file") {
      child.path = newPath + "/" + child.name;
    } else {
      child.path = newPath + "/" + child.name;
      updatePath(child, child.path);
    }
  });
};

export const checkIfNameIsValid = (name: string) => {
  console.log("received name in checkIfNameIsValid", name);
  if (name.length === 0) {
    console.log("name length is 0");
    return false;
  }

  const pattern = /^(?!\.{1,2}$)[^/\0]{1,255}$/;
  if (pattern.test(name)) {
    // Additional checks
    if (name.trim() !== name) {
      // Check for leading/trailing spaces
      return false;
    }
    if ([...name].some((char) => char.charCodeAt(0) < 32)) {
      // Check for control characters
      return false;
    }
    return true;
  }
  return false;
};

export const checkIfNameIsUnique = (node: TreeNode, name: string) => {
  if (node.type === "file") {
    throw new Error("Not a folder");
  }
  const lowercaseName = name.toLowerCase();
  const nodeExists = node.children.find(
    (child) => child.name.toLowerCase() === lowercaseName
  );

  return nodeExists ? false : true;
};
// const config: ManifestConfig = {
//   activeIconPack: "angular",
//   hidesExplorerArrows: true,
//   folders: {
//     theme: "classic",
//     associations: {},
//   },
//   files: {
//     associations: {
//       git: "git",
//       env: "env",
//       zip: "zip",
//     },
//   },
//   languages: {
//     associations: {},
//   },
// };
// const manifest = generateManifest(config);
// console.log(manifest);
