import React from "react";
import { useEffect, useState } from "react";
import { Input } from "./ui/Input";
import "../styles/template-search-modal.css";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { baseUrl } from "../constants";
import { useNavigate } from "react-router-dom";
import { useUserStore, useWorkspaceStore } from "../store";

interface SelectedTemplate {
  label: string;
  value: string;
  iconUrl: string;
  description: string;
}

interface CreateWorkspaceParams {
  baseUrl: string;
  body: {
    type: string;
    workspaceName: string;
    visibility: "public" | "private";
  };
}

interface CreateWorkspaceResponse {
  workspaceName: string;
  workspaceLink: string;
}

const Templates: SelectedTemplate[] = [
  {
    label: "Node.js",
    value: "node",
    iconUrl:
      "https://replit.com/cdn-cgi/image/width=64,quality=80,format=auto/https://storage.googleapis.com/replit/images/1664475621720_efa68b913cf8f7ee5b6c5ccc33a85f7f.jpeg",
    description:
      "Nodejs is an open-source, cross-platform, back-end JavaScript runtime environment.",
  },
  {
    label: "Express.js",
    value: "express.js",
    iconUrl:
      "https://replit.com/cdn-cgi/image/width=32,quality=80,format=auto/https://storage.googleapis.com/replit/images/1692134057021_40d3af60d2260c8417fb94a7736fc4f9.png",
    description: "Fast, unopinionated, minimalist web framework for Node.js",
  },
  {
    label: "React Javascript",
    value: "react javascript",
    iconUrl:
      "https://replit.com/cdn-cgi/image/width=64,quality=80,format=auto/https://storage.googleapis.com/replit/images/1664482201390_54d5b102c7f35e5b43228d224c94a745.jpeg",
    description: "Online React Editor and IDE: compile, and run React apps",
  },
  {
    label: "React Typescript",
    value: "react typescript",
    iconUrl:
      "https://replit.com/cdn-cgi/image/width=64,quality=80,format=auto/https://storage.googleapis.com/replit/images/1664482257238_8286854f8e0f432330b6f9998f1660df.jpeg",
    description: "Build a React application with TypeScript",
  },
  {
    label: "Html + Css + Js",
    value: "html + css + js",
    iconUrl:
      "https://replit.com/cdn-cgi/image/width=64,quality=80,format=auto/https://storage.googleapis.com/replit/images/1664473044967_513d905f04b05dc76a37ec102fb668eb.jpeg",
    description: "Dive into the world of vanilla web development",
  },
  {
    label: "C++",
    value: "c++",
    iconUrl:
      "https://replit.com/cdn-cgi/image/width=64,quality=80,format=auto/https://storage.googleapis.com/replit/images/1664475614749_e676afef2f67934841044fcd676436ca.jpeg",
    description:
      "C++ is a low-level and cross-platform imperative language. It has object-oriented, generic, and functional features.",
  },
  {
    label: "C",
    value: "c",
    iconUrl:
      "https://replit.com/cdn-cgi/image/width=64,quality=80,format=auto/https://storage.googleapis.com/replit/images/1664475627998_03dab003aa2236b1a3f44cb52bcbdf04.jpeg",
    description:
      "C is a general-purpose computer programming language. It's used in operating systems, device drivers, and protocol stacks.",
  },
];
const TemplateSearchModal = () => {
  const username = useUserStore((state) => state.username);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState(Templates);
  const [selectedTemplate, setSelectedTemplate] =
    useState<SelectedTemplate | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const setWorkspaceData = useWorkspaceStore((state) => state.setWorkspaceData);
  const navigate = useNavigate();

  useEffect(() => {
    setSearchResults(
      Templates.filter((template) =>
        template.value.includes(searchValue.toLowerCase())
      )
    );
  }, [searchValue]);

  const { mutate: createWorkspaceRequest, isPending } = useMutation({
    mutationFn: async (params: CreateWorkspaceParams) => {
      const { baseUrl, body } = params;
      const { data } = await axios.post(`${baseUrl}/workspace/create`, body, {
        withCredentials: true,
      });
      return data as CreateWorkspaceResponse;
    },
    onSuccess: (data) => {
      const linkSplit = data.workspaceLink!.split("?");
      const baseLinkCopy = linkSplit[0]
        .slice(0, -2)
        .split("/")
        .slice(0, -2)
        .join("/");
      const policyCopy = linkSplit[1];
      setWorkspaceData(
        data.workspaceName,
        data.workspaceLink,
        baseLinkCopy,
        policyCopy,
        null
        // [data.fileTree]
      );
      navigate(`/workspace/${username}/${data.workspaceName}`);
      // Redirect user to /:username/:workspaceName
      // When user creates a new workspace, we can use the public spaces link to fetch files.
      // But if user is accessing a already created wokspace, we need some private link to fetch files.
    },
    onError: (error) => {
      console.error(error);
      // @ts-ignore
      console.error(error.response.data.error[0].message);
    },
  });
  const handleSelectTemplate = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    const target = e.target as HTMLElement;
    const templateCard = target.closest(".template-card") as HTMLElement;
    if (templateCard) {
      const id = templateCard.getAttribute("id");
      setSearchValue(id!);
      const selected = Templates.find((template) => template.value === id);
      setSelectedTemplate(selected!);
      // Add your logic here to handle the selected template
    }
  };

  const createWorkspace = () => {
    if (!selectedTemplate?.value) {
      return;
    }
    const body = {
      type: selectedTemplate.value,
      workspaceName,
      visibility: isPublic ? "public" : ("private" as "public" | "private"),
    };
    createWorkspaceRequest({ baseUrl, body });
  };

  const resetInput = () => {
    setSearchValue("");
    setSelectedTemplate(null);
  };
  return (
    <div className="flex flex-col gap-4 px-2 py-4 modal-body sm:flex-row">
      <div className="w-full lhs sm:w-[55%]">
        <div className="w-full">
          <p className="mb-2">Template</p>
          <Input
            type="text"
            placeholder="Search Template"
            className="bg-[#2B3245] focus:bg-[#3C445C] focus:border-2 focus:border-[#0079F2] border-none focus:border-solid"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onClick={resetInput}
          />
          <div
            className="templates-container h-[225px] w-full rounded-md my-2 overflow-y-scroll border-[#2A3244] border"
            onClick={handleSelectTemplate}
          >
            {selectedTemplate ? (
              <div className="flex flex-col justify-around h-full p-2 selected-template-card">
                <div className="header">
                  <div className="mb-2">
                    <img
                      src={selectedTemplate.iconUrl}
                      alt={selectedTemplate.label}
                      className="w-10 h-10 rounded-md"
                    />
                  </div>
                  <p className="text-2xl text-white">
                    {selectedTemplate.label}
                  </p>
                </div>
                <div className="footer">
                  <p className="text-[#9DA2A6]">
                    {selectedTemplate.description}
                  </p>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((template) => (
                <div
                  key={template.value}
                  className="flex items-center gap-3 p-2 cursor-pointer template-card hover:bg-[#3C445C]"
                  id={template.value}
                >
                  <img
                    src={template.iconUrl}
                    alt={template.label}
                    className="w-8 h-8 rounded-md"
                  />
                  <p>{template.label}</p>
                </div>
              ))
            ) : (
              <p>No results found</p>
            )}
          </div>
        </div>
      </div>
      <div className="w-full rhs sm:w-[45%]">
        <div className="flex flex-col justify-between w-full h-full">
          <div className="header">
            <p className="mb-2">Title</p>
            <Input
              type="text"
              placeholder="Name your workspace (optional)"
              className="bg-[#2B3245] focus:bg-[#3C445C] focus:border-2 focus:border-[#0079F2] border-none focus:border-solid"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
            {/* Create a checkbox with the label public */}
            <div className="flex items-center gap-2 mt-3">
              <Input
                type="checkbox"
                id="public"
                name="public"
                className="inline w-6 h-6 cursor-pointer"
                defaultChecked={true}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <label htmlFor="public">Public</label>
            </div>
            <p className="info text-[#9DA2A6] text-xs mt-1">
              {isPublic
                ? "Anyone can view and fork this workspace."
                : "Only you can view this workspace."}
            </p>
          </div>
          <div className="footer">
            <button
              className="w-full btn-primary text-[#F5F9FC] bg-[#0053A6] rounded-md hover:bg-[#0079F2] py-2 my-2"
              onClick={createWorkspace}
              disabled={isPending}
            >
              + Create Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateSearchModal;
