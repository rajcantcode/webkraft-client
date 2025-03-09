const LoadingNode = ({
  padLeft,
  height,
  start,
}: {
  padLeft: number;
  height: number;
  start: number;
}) => {
  return (
    <div
      className="absolute top-0 left-0 flex items-center justify-center text-sm"
      style={{
        height: `${height}px`,
        transform: `translateY(${start}px)`,
        width: `calc(100% - ${padLeft}px)`,
        marginLeft: `${padLeft}px`,
      }}
    >
      <div className="h-[80%] w-full bg-[#313f60] rounded-md animate-pulse"></div>
    </div>
  );
};

export default LoadingNode;
