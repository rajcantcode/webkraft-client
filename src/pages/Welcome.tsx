import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { verifyUser } from "../helpers";
import { useQuery } from "@tanstack/react-query";

const Welcome = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, status } = useQuery({
    queryKey: ["auth"],
    queryFn: verifyUser,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (status === "success") {
      navigate("/home");
    }
  }, [status]);

  return (
    <div>
      {isLoading ? (
        <p>Verifying user please wait</p>
      ) : (
        <div>
          <p>Welcome to the Kodeit!</p>
          <Link to="/login">Login</Link>
          <Link to="/signup">signup</Link>
        </div>
      )}
    </div>
  );
};

export default Welcome;
