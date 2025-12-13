import { supabase } from "./supabase/supabaseClient.js";

/* Navigation */
window.openScreen = (id) => {
  document.getElementById("settings-main").style.display = "none";
  document.getElementById(id).style.display = "block";
};

window.goBack = () => {
  document.querySelectorAll(".sub-screen").forEach(s => s.style.display = "none");
  document.getElementById("settings-main").style.display = "block";
};

/* Toggle Password Eye */
window.togglePassword = (id, el) => {
  const input = document.getElementById(id);

  if (input.type === "password") {
    input.type = "text";
    el.textContent = "🙈";
  } else {
    input.type = "password";
    el.textContent = "👁️";
  }
};

/* Password Verification */
async function verifyPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/* Change Password */
window.changePassword = async () => {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return alert("Please login again.");

  const currentPass = document.getElementById("currentPass").value;
  const newPass = document.getElementById("newPass").value;
  const confirmPass = document.getElementById("confirmPass").value;

  if (!currentPass || !newPass || !confirmPass)
    return alert("All fields required.");

  if (newPass !== confirmPass)
    return alert("New passwords do not match.");

  const valid = await verifyPassword(user.email, currentPass);
  if (!valid) return alert("Incorrect current password.");

  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) return alert(error.message);

  alert("Password updated!");
  goBack();
};

/* Delete Account */
window.deleteAccount = async () => {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return alert("Please login again.");

  const pass = document.getElementById("deletePass").value;
  if (!pass) return alert("Enter your password.");

  const valid = await verifyPassword(user.email, pass);
  if (!valid) return alert("Incorrect password.");

  await supabase.from("users").update({ deleted: true }).eq("id", user.id);
  await supabase.auth.signOut();

  alert("Account deleted.");
  window.location.href = "auth.html";
};
