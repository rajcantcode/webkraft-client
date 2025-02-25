import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import Workspace from "./pages/Workspace";
import Layout from "./components/Layout";
import Welcome from "./pages/Welcome";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Welcome />}></Route>
          <Route path="/login" element={<Login />}></Route>
          <Route path="/signup" element={<SignUp />}></Route>
          <Route path="/home" element={<Home />}></Route>
          <Route
            path="workspace/:username/:workspacename"
            element={<Workspace />}
          ></Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
