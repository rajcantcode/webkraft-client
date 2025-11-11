import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn, getFileIcon } from "../lib/utils";
import { useGitStore, useUserStore } from "../store";
import { Input } from "./ui/Input";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { TooltipWrapper } from "./ui/ToolTip";
import { FaGitAlt } from "react-icons/fa";
import { VscDiscard } from "react-icons/vsc";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/Select";
import { Socket } from "socket.io-client";
import { GitRepoInfo } from "../types/git";
import LoadingSpinner from "./ui/LoadingSpinner";

const Vcs = ({
  className,
  socket,
  isVisible,
}: {
  className: string;
  socket: Socket | null;
  isVisible: boolean;
}) => {
  const { isGitRepo, repoInfo, setRepoInfo, setGitData } = useGitStore();
  const [collapseState, setCollapseState] = useState({
    repos: false,
    changes: false,
    staged: false,
    unstaged: false,
  });
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const reposContainerRef = useRef<HTMLDivElement>(null);
  const changesContainerRef = useRef<HTMLDivElement>(null);
  const toggleCollapse = useCallback(
    (clicked: "repos" | "changes" | "staged" | "unstaged") => {
      setCollapseState((prev) => ({ ...prev, [clicked]: !prev[clicked] }));
    },
    []
  );

  const handleGitAction = useCallback(
    (
      action:
        | "stage"
        | "unstage"
        | "discard"
        | "stage-all"
        | "unstage-all"
        | "discard-all"
        | "commit"
        | "checkout",
      filePath?: string,
      branchName?: string,
      repoName?: string,
      commitMessage?: string
    ) => {
      if (!socket) return;
      try {
        if (
          action === "stage" ||
          action === "unstage" ||
          action === "discard"
        ) {
          if (!filePath) return;
          socket.emit(
            `git:${action}`,
            filePath,
            (error: { msg: string } | null, repoInfo: GitRepoInfo) => {
              if (error) {
                toast.error(error.msg);
                return;
              } else {
                setRepoInfo(repoInfo);
              }
            }
          );
        } else if (
          action === "stage-all" ||
          action === "unstage-all" ||
          action === "discard-all"
        ) {
          socket.emit(
            `git:${action}`,
            "",
            (error: { msg: string } | null, repoInfo: GitRepoInfo) => {
              if (error) {
                toast.error(error.msg);
                return;
              } else {
                setRepoInfo(repoInfo);
              }
            }
          );
        } else if (action === "checkout") {
          if (!branchName || !repoName) return;
          socket.emit(
            `git:check-branch`,
            { branchName, repoName },
            (error: { msg: string } | null, repoInfo: GitRepoInfo) => {
              if (error) {
                toast.error(error.msg);
                return;
              } else {
                setRepoInfo(repoInfo);
              }
            }
          );
        } else if (action === "commit") {
          if (!commitMessage) {
            toast.error("Commit message cannot be empty");
            return;
          }
          socket.emit(
            "git:commit",
            commitMessage,
            (error: { msg: string } | null, repoInfo: GitRepoInfo) => {
              if (error) {
                toast.error(error.msg);
                return;
              } else {
                setRepoInfo(repoInfo);
                setCommitMsg("");
              }
            }
          );
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [socket, setRepoInfo]
  );

  const switchRepo = useCallback(
    (repo: string, curRepo: string) => {
      if (!socket) return;
      if (repo === curRepo) return;
      setLoading(true);
      socket.emit(
        "git:curRepoName",
        repo,
        (error: { msg: string } | null, repoInfo: GitRepoInfo) => {
          if (error) {
            toast.error(error.msg);
            setLoading(false);
            return;
          }
          setRepoInfo(repoInfo);
          setLoading(false);
        }
      );
    },
    [socket, setRepoInfo]
  );

  useEffect(() => {
    if (!socket) return;
    const handleGitInfo = ({
      isGitRepo,
      repoInfo,
    }: {
      isGitRepo: boolean;
      repoInfo: GitRepoInfo;
    }) => {
      setGitData(isGitRepo, repoInfo);
    };
    socket.on("git:info", handleGitInfo);

    return () => {
      socket.off("git:info", handleGitInfo);
    };
  }, [socket, setGitData]);

  const handleInitializeRepository = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (!socket) return;
      setLoading(true);
      const inputsContainer = e.currentTarget.closest(".inputs");
      if (!inputsContainer) return;
      const usernameInput = inputsContainer.querySelector(
        "#git-username"
      ) as HTMLInputElement;
      const emailInput = inputsContainer.querySelector(
        "#git-email"
      ) as HTMLInputElement;
      const username = usernameInput.value;
      const email = emailInput.value;

      socket.emit(
        "git:init",
        { username, email },
        (error: { msg: string } | null, repoInfo: GitRepoInfo) => {
          if (error) {
            toast.error(error.msg);
            setLoading(false);
            return;
          }
          setGitData(true, repoInfo);
          setLoading(false);
        }
      );
    },
    [socket, setGitData]
  );

  const setReposAndChangesHeight = useCallback(
    (
      repoHeight: number,
      changesHeight: number,
      setFor: "reposAndChanges" | "stagedAndUnstagedChanges"
    ) => {
      if (
        setFor === "reposAndChanges" &&
        reposContainerRef.current &&
        changesContainerRef.current
      ) {
        // reposContainerRef.current.style.minHeight = `${repoHeight}px`;
        // changesContainerRef.current.style.minHeight = `${changesHeight}px`;
        reposContainerRef.current.style.maxHeight = `${repoHeight}px`;
        changesContainerRef.current.style.maxHeight = `${changesHeight}px`;

        reposContainerRef.current.dataset.maxHeight = `${repoHeight}`;
        changesContainerRef.current.dataset.maxHeight = `${changesHeight}`;
      }
      if (
        setFor === "stagedAndUnstagedChanges" &&
        stagedChangesContainerRef.current &&
        unstagedChangesContainerRef.current
      ) {
        // stagedChangesContainerRef.current.style.minHeight = `${repoHeight}px`;
        // unstagedChangesContainerRef.current.style.minHeight = `${changesHeight}px`;
        stagedChangesContainerRef.current.style.maxHeight = `${repoHeight}px`;
        unstagedChangesContainerRef.current.style.maxHeight = `${changesHeight}px`;

        stagedChangesContainerRef.current.dataset.maxHeight = `${repoHeight}`;
        unstagedChangesContainerRef.current.dataset.maxHeight = `${changesHeight}`;
      }
    },
    []
  );

  useEffect(() => {
    if (
      !containerRef.current ||
      !repoInfo ||
      !reposContainerRef.current ||
      !changesContainerRef.current
    ) {
      return;
    }
    console.log("container height is - ", containerRef.current.clientHeight);
    // Max height for repos and changes section
    const maxHeight = (containerRef.current.clientHeight - 20 - 12) / 2; // minus title and padding

    const heightRequiredByRepos = 24 + repoInfo.repos.length * 36;

    let heightRequiredByChanges = 0;
    if (
      repoInfo.changes.staged.length === 0 &&
      repoInfo.changes.unstaged.length === 0
    ) {
      heightRequiredByChanges = 0;
      reposContainerRef.current.style.height = `calc(100% - 20px)`;
      return;
    } else {
      heightRequiredByChanges = 24 + 70; // title + commit msg box
    }
    if (repoInfo.changes.staged.length > 0) {
      heightRequiredByChanges += 24 + repoInfo.changes.staged.length * 20;
    }
    if (repoInfo.changes.unstaged.length > 0) {
      heightRequiredByChanges += 24 + repoInfo.changes.unstaged.length * 20 + 4; // 4 for padding bottom
    }
    if (maxHeight > heightRequiredByRepos) {
      setReposAndChangesHeight(
        heightRequiredByRepos,
        maxHeight + (maxHeight - heightRequiredByRepos),
        "reposAndChanges"
      );
    } else if (maxHeight === heightRequiredByRepos) {
      setReposAndChangesHeight(maxHeight, maxHeight, "reposAndChanges");
    } else if (maxHeight < heightRequiredByRepos) {
      if (maxHeight > heightRequiredByChanges) {
        setReposAndChangesHeight(
          maxHeight + maxHeight - heightRequiredByChanges,
          heightRequiredByChanges,
          "reposAndChanges"
        );
      } else {
        setReposAndChangesHeight(maxHeight, maxHeight, "reposAndChanges");
      }
    }
  }, [repoInfo, isVisible, setReposAndChangesHeight]);

  const stagedChangesContainerRef = useRef<HTMLDivElement>(null);
  const unstagedChangesContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !isVisible ||
      !repoInfo ||
      !stagedChangesContainerRef.current ||
      !unstagedChangesContainerRef.current ||
      !changesContainerRef.current
    )
      return;
    if (
      repoInfo.changes.staged.length > 0 &&
      repoInfo.changes.unstaged.length === 0
    ) {
      stagedChangesContainerRef.current.style.minHeight = "100%";
      stagedChangesContainerRef.current.style.maxHeight = "100%";
      return;
    }
    if (
      repoInfo.changes.unstaged.length > 0 &&
      repoInfo.changes.staged.length === 0
    ) {
      unstagedChangesContainerRef.current.style.minHeight = "100%";
      unstagedChangesContainerRef.current.style.maxHeight = "100%";
      return;
    }
    const maxHeight = (changesContainerRef.current.clientHeight - 24 - 70) / 2; // minus title and commit msg box
    const heightRequiredByStagedChanges =
      24 + repoInfo.changes.staged.length * 20 + 4; // 4 for padding bottom

    if (maxHeight > heightRequiredByStagedChanges) {
      setReposAndChangesHeight(
        heightRequiredByStagedChanges,
        maxHeight + (maxHeight - heightRequiredByStagedChanges),
        "stagedAndUnstagedChanges"
      );
    } else if (maxHeight === heightRequiredByStagedChanges) {
      setReposAndChangesHeight(
        maxHeight,
        maxHeight,
        "stagedAndUnstagedChanges"
      );
    } else if (maxHeight < heightRequiredByStagedChanges) {
      const heightRequiredByUnstagedChanges =
        24 + repoInfo.changes.unstaged.length * 20 + 4; // 4 for padding bottom
      if (maxHeight > heightRequiredByUnstagedChanges) {
        setReposAndChangesHeight(
          maxHeight + maxHeight - heightRequiredByUnstagedChanges,
          heightRequiredByUnstagedChanges,
          "stagedAndUnstagedChanges"
        );
      } else {
        setReposAndChangesHeight(
          maxHeight,
          maxHeight,
          "stagedAndUnstagedChanges"
        );
      }
    }
  }, [isVisible, repoInfo, setReposAndChangesHeight]);

  if (!isGitRepo || !repoInfo) {
    return (
      <div className="flex flex-col w-full h-full gap-3 p-1.5 cursor-pointer">
        <p className="border-b border-b-[#959a9e]">
          The folder currently open doesn't have a Git repository. You can
          initialize a repository which will enable source control features
          powered by Git.
        </p>
        <div className="inputs flex flex-col gap-1.5">
          <p className="text-sm ">
            Enter the username and email, you want to be associated with your
            local git repository
          </p>
          <Input
            type="text"
            placeholder="username"
            defaultValue={useUserStore.getState().username}
            id="git-username"
            className="border border-[#959a9e] focus-visible:border-none focus-visible:border-0"
          />
          <Input
            type="text"
            placeholder="email"
            defaultValue={useUserStore.getState().email}
            id="git-email"
            className="border border-[#959a9e] focus-visible:border-none focus-visible:border-0"
          />
          <button
            className="w-full p-2 text-center bg-gray-800 rounded-md hover:bg-gray-700"
            onClick={handleInitializeRepository}
            disabled={loading}
          >
            {loading ? <LoadingSpinner /> : "Initialize repository"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full flex-col overflow-hidden p-1.5 cursor-pointer relative",
        className
      )}
    >
      <div
        className={`flex items-center gap-2 mb-1 title before:content-[''] before:absolute before:bottom-0 before:left-0 before:h-[2px] before:bg-[#0179F2] before:w-3 before:rounded-md relative ${
          loading ? "before:animate-moveX before:block" : "before:hidden"
        }`}
      >
        <FaGitAlt />
        <p className="text-sm title">SOURCE CONTROL</p>
      </div>
      {loading && (
        <div className="blocker absolute h-[calc(100%-20px)] top-[20px] w-full bg-[#00000045] z-10 cursor-not-allowed"></div>
      )}
      <div
        className="box-border flex flex-col overflow-hidden repositories"
        ref={reposContainerRef}
      >
        <div
          className="flex items-center h-6 border-b border-b-[#959a9e] title gap-2"
          onClick={() => toggleCollapse("repos")}
        >
          <div className="toggle-arrow">
            {collapseState.repos ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
          <p className="text-xs font-bold">Repositories</p>
        </div>
        <div
          className="repos-list overflow-auto max-h-[calc(100%-24px)] w-full"
          style={{
            maxHeight: collapseState.repos ? "0px" : "calc(100% - 24px)",
            transition: "max-height 0.3s ease",
            scrollbarWidth: "none",
            // scrollbarWidth: "none",
          }}
        >
          {repoInfo.repos.map((repo) => (
            <div
              key={repo}
              className={`flex items-center justify-between cursor-pointer repo-item hover:bg-[#1C2333] rounded-md ${
                repoInfo.repos.length > 1 && repo === repoInfo.curRepo
                  ? "bg-[#2B3245]"
                  : ""
              }`}
            >
              <div
                className="flex items-center gap-2 repo-name w-[60%]"
                onClick={(e) => {
                  e.stopPropagation();
                  switchRepo(repo, repoInfo.curRepo);
                }}
              >
                <div className="codicon codicon-repo"></div>
                <p
                  className={`overflow-hidden text-ellipsis whitespace-nowrap`}
                >
                  {repo}
                </p>
              </div>

              {repoInfo.branches[repo].all.length > 0 &&
              repoInfo.branches[repo].current !== "" ? (
                <Select
                  onValueChange={(value) => {
                    handleGitAction("checkout", undefined, value, repo);
                  }}
                >
                  <SelectTrigger className="border-0 outline-none focus-visible:ring-0 hover:bg-[#212838] w-[40%] p-0">
                    <SelectValue
                      placeholder={
                        <div className="flex items-center w-full gap-1">
                          <div className="w-4 h-4 codicon codicon-git-branch"></div>
                          <p className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {repoInfo.branches[repo].current}
                          </p>
                        </div>
                      }
                    ></SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#1B2333] border-[#959a9e]">
                    <SelectGroup>
                      {repoInfo.branches[repo].all.map((branch) => (
                        <SelectItem value={branch} key={branch}>
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-4 codicon codicon-git-branch"></div>
                            {branch}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {repoInfo.changes.staged.length > 0 ||
      repoInfo.changes.unstaged.length > 0 ? (
        <div
          className="flex flex-col overflow-hidden changes"
          ref={changesContainerRef}
        >
          <div
            className="flex items-center min-h-6 border-b border-b-[#959a9e] title gap-2"
            onClick={() => toggleCollapse("changes")}
          >
            <div className="toggle-arrow">
              {collapseState.changes ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
            <p className="text-xs font-bold">Changes</p>
          </div>
          <div
            className="flex flex-col overflow-hidden max-h-[calc(100%-24px)]"
            style={{
              maxHeight: collapseState.changes ? "0" : "calc(100% - 24px)",
              transition: "max-height 0.3s ease",
            }}
          >
            <div className="flex flex-col justify-between commit-msg-container min-h-[70px] mb-2">
              <Input
                type="text"
                className="w-full px-2 py-1 bg-[#1B2333] border-none rounded-none outline-none focus-visible:ring-0 "
                placeholder="Enter commit message here"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
              />
              <button
                className="w-full text-center bg-gray-800 hover:bg-gray-700"
                onClick={() =>
                  handleGitAction(
                    "commit",
                    undefined,
                    undefined,
                    undefined,
                    commitMsg
                  )
                }
                disabled={repoInfo.changes.staged.length === 0}
                style={{
                  cursor:
                    repoInfo.changes.staged.length === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Commit
              </button>
            </div>
            <div className="changes-list overflow-hidden min-h-[calc(100%-70px)] ml-2">
              {repoInfo.changes.staged.length !== 0 && (
                <div
                  className="flex flex-col pb-1 staged-changes"
                  ref={stagedChangesContainerRef}
                >
                  <div
                    className="flex justify-between min-h-6 group border-b border-b-[#959a9e] items-center px-1"
                    onClick={() => toggleCollapse("staged")}
                  >
                    <div className="flex items-center gap-2 font-bold LHS title">
                      <div className="toggle-arrow">
                        {collapseState.staged ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                      <p className="text-xs font-bold">Staged Changes</p>
                    </div>
                    <div className="flex items-center gap-1 RHS">
                      <TooltipWrapper title="Unstage All Changes">
                        <Minus
                          className="w-4 h-4 hidden group-hover:block hover:bg-[#2B3245] p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGitAction("unstage-all");
                          }}
                        />
                      </TooltipWrapper>
                      <p className="text-xs font-bold">
                        {repoInfo.changes.staged.length}
                      </p>
                    </div>
                  </div>
                  <div
                    className="overflow-x-hidden overflow-y-auto max-h-[calc(100%-24px)]"
                    style={{
                      scrollbarWidth: "none",
                      maxHeight: collapseState.staged
                        ? "0"
                        : "calc(100% - 24px)",
                      // transition: "max-height 2s ease",
                    }}
                  >
                    {repoInfo.changes.staged.map((change) => {
                      // change.name is the relative path of the file and not the file name
                      const pathSplit = change.name.split("/");
                      const fileName = pathSplit.pop();
                      const dirName = pathSplit.join("/");
                      return (
                        <div
                          className="flex items-center justify-between change group hover:bg-[#1C2333] rounded-md px-1"
                          key={change.name}
                        >
                          <div className="flex items-center gap-2 LHS w-[calc(100%-34px)]">
                            <img
                              src={getFileIcon(fileName!)}
                              alt=""
                              className="w-4 h-4"
                            />
                            <div className="flex items-baseline gap-2 name-and-path w-[calc(100%-16px)]">
                              <p className="overflow-hidden text-sm file-name text-ellipsis whitespace-nowrap">
                                {fileName}
                              </p>
                              <p className="overflow-hidden text-xs text-gray-400 relative-path text-ellipsis whitespace-nowrap">
                                {dirName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 RHS">
                            <TooltipWrapper title="Unstage Changes">
                              <Minus
                                className="hidden w-4 h-4 group-hover:block p-0.5 hover:bg-[#2B3245]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGitAction("unstage", change.path);
                                }}
                              />
                            </TooltipWrapper>
                            <p className="text-xs index">{change.index}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {repoInfo.changes.unstaged.length !== 0 && (
                <div
                  className="flex flex-col pb-1 unstaged-changes"
                  ref={unstagedChangesContainerRef}
                >
                  <div
                    className="flex justify-between min-h-6 group border-b items-center border-b-[#959a9e] px-1"
                    onClick={() => toggleCollapse("unstaged")}
                  >
                    <div className="flex items-center gap-2 font-bold LHS title">
                      <div className="toggle-arrow">
                        {collapseState.unstaged ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                      <p className="text-xs font-bold">Changes</p>
                    </div>
                    <div className="flex items-center gap-1 RHS">
                      <TooltipWrapper title="Discard All Changes">
                        <div
                          className="hidden group-hover:block hover:bg-[#2B3245] p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGitAction("discard-all");
                          }}
                        >
                          <VscDiscard className="w-3 h-3" />
                        </div>
                      </TooltipWrapper>
                      <TooltipWrapper title="Stage All Changes">
                        <Plus
                          className="hidden w-4 h-4 group-hover:block hover:bg-[#2B3245] p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGitAction("stage-all");
                          }}
                        />
                      </TooltipWrapper>
                      <p className="text-xs font-bold">
                        {repoInfo.changes.unstaged.length}
                      </p>
                    </div>
                  </div>
                  <div
                    className="overflow-x-hidden overflow-y-auto max-h-[calc(100%-24px)]"
                    style={{
                      scrollbarWidth: "none",
                      maxHeight: collapseState.unstaged
                        ? "0"
                        : "calc(100% - 24px)",
                      // transition: "max-height 0.3s ease",
                    }}
                  >
                    {repoInfo.changes.unstaged.map((change) => {
                      // change.name is the relative path of the file and not the file name
                      const pathSplit = change.name.split("/");
                      const fileName = pathSplit.pop();
                      const dirName = pathSplit.join("/");
                      return (
                        <div
                          className="flex items-center justify-between change group hover:bg-[#1C2333] w-full rounded-md px-1"
                          key={change.name}
                        >
                          <div className="flex items-center gap-2 LHS w-[calc(100%-54px)]">
                            <img
                              src={getFileIcon(fileName!)}
                              className="w-4 h-4"
                              alt=""
                            />
                            <div className="flex items-baseline gap-2 name-and-path w-[calc(100%-16px)]">
                              <p className="overflow-hidden text-sm file-name text-ellipsis whitespace-nowrap">
                                {fileName}
                              </p>
                              <p className="overflow-hidden text-xs text-gray-400 relative-path text-ellipsis whitespace-nowrap">
                                {dirName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 RHS">
                            <div className="flex items-center gap-1 icons">
                              <TooltipWrapper title="Discard Changes">
                                <div
                                  className="hidden group-hover:block p-0.5 hover:bg-[#2B3245]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitAction("discard", change.path);
                                  }}
                                >
                                  <VscDiscard className="w-3 h-3" />
                                </div>
                              </TooltipWrapper>
                              <TooltipWrapper title="Stage Changes">
                                <Plus
                                  className="hidden w-4 h-4 group-hover:block p-0.5 hover:bg-[#2B3245]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitAction("stage", change.path);
                                  }}
                                />
                              </TooltipWrapper>
                            </div>
                            <p className="text-xs index">{change.index}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const memoizedVcs = React.memo(Vcs);
memoizedVcs.displayName = "Vcs";
export default memoizedVcs;
