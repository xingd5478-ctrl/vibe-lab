function patch_models()
%PATCH_MODELS Fix two tutorial models so their recorded outputs are meaningful.
%  t35: both To Workspace blocks were wired to SumFusion; t_mdl now gets a Clock.
%  t32: add PD state feedback so the inverted pendulum stays bounded.
% The changes are idempotent; run from the repository root.

root = fileparts(fileparts(mfilename('fullpath')));
models = fullfile(root, "simulink", "models");
load_system("simulink");

% ----- t35: time channel -----
mdl = "tutorial35_imu";
load_system(fullfile(models, mdl + ".slx"));
if isempty(find_system(mdl, "SearchDepth", 1, "Name", "Clock_t"))
    try, delete_line(mdl, "SumFusion/1", "ws_time_mdl/1"); catch, end
    add_block("simulink/Sources/Clock", mdl + "/Clock_t", ...
        "Position", [520, 300, 550, 330]);
    add_line(mdl, "Clock_t/1", "ws_time_mdl/1", "autorouting", "on");
end
save_system(mdl);
close_system(mdl, 0);
fprintf("patched %s\n", mdl);

% ----- t32: PD stabilizer -----
mdl = "tutorial32_pendulum";
load_system(fullfile(models, mdl + ".slx"));
if isempty(find_system(mdl, "SearchDepth", 1, "Name", "Ctrl_Sum"))
    try, delete_line(mdl, "Input_u/1", "Pendulum_Plant/1"); catch, end
    add_block("simulink/Math Operations/Sum", mdl + "/Sum_U", ...
        "Inputs", "|++", "Position", [160, 150, 190, 180]);
    add_block("simulink/Math Operations/Sum", mdl + "/Ctrl_Sum", ...
        "Inputs", "|--", "IconShape", "round", "Position", [280, 220, 310, 250]);
    add_block("simulink/Math Operations/Gain", mdl + "/K_theta", ...
        "Gain", "20", "Position", [320, 210, 350, 240]);
    add_block("simulink/Math Operations/Gain", mdl + "/K_omega", ...
        "Gain", "8", "Position", [320, 270, 350, 300]);
    add_line(mdl, "Input_u/1", "Sum_U/1", "autorouting", "on");
    add_line(mdl, "Pendulum_Plant/1", "K_theta/1", "autorouting", "on");
    add_line(mdl, "Pendulum_Plant/2", "K_omega/1", "autorouting", "on");
    add_line(mdl, "K_theta/1", "Ctrl_Sum/1", "autorouting", "on");
    add_line(mdl, "K_omega/1", "Ctrl_Sum/2", "autorouting", "on");
    add_line(mdl, "Ctrl_Sum/1", "Sum_U/2", "autorouting", "on");
    add_line(mdl, "Sum_U/1", "Pendulum_Plant/1", "autorouting", "on");
end
save_system(mdl);
close_system(mdl, 0);
fprintf("patched %s\n", mdl);
end
