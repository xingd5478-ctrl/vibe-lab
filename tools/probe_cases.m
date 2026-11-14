function probe_cases()
%PROBE_CASES Probe t20/t21/t31 with output logging and print comparison metrics.
%
% Run from the repository root:
%   matlab -batch "addpath('tools'); probe_cases"
%
% The vendored .slx files are copied to %TEMP%\vibemodels before simulating;
% probe signals are added in memory only, so the models themselves stay clean.
% Results are written to artifacts/simulink/*.mat (gitignored) and printed.

root = fileparts(fileparts(mfilename('fullpath')));
outDir = fullfile(root, "artifacts", "simulink");
if ~exist(outDir, "dir"), mkdir(outDir); end
old = pwd;
cleanup = onCleanup(@() cd(old)); %#ok<NASGU>
cd(root);

probe_t20(outDir);
probe_t21(outDir);
probe_t31(outDir);
end

% -------------------------------------------------------------------------
function probe_t20(outDir)
out = run_probe("tutorial20_mpc", ...
    {{"Plant", "y"}, {"PID", "u"}}, 0.01);
save(fullfile(outDir, "tutorial20_mpc.mat"), "out");

t = out.y.Time; y = out.y.Data; u = out.u.Data;
[peak, ip] = max(y);
tail = t >= 8;
fprintf("t20 MPC/PID: peak=%.6f at %.3fs, final=%.6f, mean(t>8)=%.6f, u_peak=%.4f\n", ...
    peak, t(ip), y(end), mean(y(tail)), max(abs(u)));
fprintf("  y(1/2/5/10 s)= %.4f / %.4f / %.4f / %.4f\n", ...
    interp1(t, y, 1), interp1(t, y, 2), interp1(t, y, 5), y(end));
end

% -------------------------------------------------------------------------
function probe_t21(outDir)
out = run_probe("tutorial21_smc", ...
    {{"Plant SMC", "y_smc"}, {"Plant PID", "y_pid"}, ...
     {"K_smc", "u_smc"}, {"PID", "u_pid"}}, 0.01);
save(fullfile(outDir, "tutorial21_smc.mat"), "out");

t = out.y_smc.Time;
[smcPeak, spi] = max(out.y_smc.Data);
[pidPeak, ppi] = max(out.y_pid.Data);
fprintf("t21 SMC: peak=%.6f at %.3fs, final=%.6f, max|e|(t>1)=%.6f\n", ...
    smcPeak, t(spi), out.y_smc.Data(end), max(abs(out.y_smc.Data(t > 1) - 1)));
fprintf("t21 PID: peak=%.6f at %.3fs, final=%.6f, u_peak=%.4f\n", ...
    pidPeak, t(ppi), out.y_pid.Data(end), max(abs(out.u_pid.Data)));
fprintf("t21 u_smc: min=%.4f max=%.4f mean|du|(t>8)=%.6f\n", ...
    min(out.u_smc.Data), max(out.u_smc.Data), ...
    mean(abs(diff(out.u_smc.Data(t(2:end) > 8)))));
end

% -------------------------------------------------------------------------
function probe_t31(outDir)
out = run_probe("tutorial31_ekf", {}, 0.01);
save(fullfile(outDir, "tutorial31_ekf.mat"), "out");

t = out.tout;
x1 = out.x1_true.Data;
x2 = out.x2_true.Data;
y = out.y_noisy.Data;
u = out.u_data.Data;

% EKF copied from the t31 lesson: Van der Pol, measure x1, Q/R as in the .m.
mu = 1.5;
Q = diag([0.01, 0.1]);
R = 0.005;
N = numel(x1);
xEst = zeros(2, N);
P = eye(2);
xh = [0; 0];
for k = 2:N
    dt = t(k) - t(k - 1);
    x1h = xh(1);
    x2h = xh(2);
    xp = xh + dt * [x2h; mu * (1 - x1h^2) * x2h - x1h + u(k - 1)];
    F = [1, dt; dt * (-2 * mu * x1h * x2h - 1), 1 + dt * mu * (1 - x1h^2)];
    Pp = F * P * F' + Q * dt;
    H = [1, 0];
    S = H * Pp * H' + R;
    K = Pp * H' / S;
    xh = xp + K * (y(k) - xp(1));
    P = (eye(2) - K * H) * Pp;
    xEst(:, k) = xh;
end

rmseMeas = sqrt(mean((y - x1).^2));
rmseE1 = sqrt(mean((xEst(1, :)' - x1).^2));
rmseE2 = sqrt(mean((xEst(2, :)' - x2).^2));
fprintf("t31 EKF: meas RMSE=%.4f, EKF x1 RMSE=%.4f (%.1f%% better), x2 RMSE=%.4f\n", ...
    rmseMeas, rmseE1, 100 * (rmseMeas - rmseE1) / rmseMeas, rmseE2);
fprintf("  samples=%d, model has no EKF block (truth/noisy measurement only)\n", N);
end

% -------------------------------------------------------------------------
function out = run_probe(name, probes, maxStep)
tmp = fullfile(tempdir, "vibemodels");
if ~exist(tmp, "dir"), mkdir(tmp); end
src = fullfile(pwd, "simulink", "models", name + ".slx");
dst = fullfile(tmp, name + ".slx");
copyfile(src, dst);
old = pwd;
cd(tmp);
cleanup = onCleanup(@() cd(old)); %#ok<NASGU>

load_system("simulink");
load_system(name + ".slx");
for p = 1:numel(probes)
    blk = probes{p}{1};
    varName = probes{p}{2};
    probe = name + "/probe_" + varName;
    add_block("simulink/Sinks/To Workspace", probe, ...
        "VariableName", varName, "SaveFormat", "Timeseries", ...
        "Position", [700, 40 + 80 * p, 760, 60 + 80 * p]);
    add_line(name, blk + "/1", "probe_" + varName + "/1", "autorouting", "on");
end
set_param(name, "MaxStep", num2str(maxStep));
out = sim(name);
close_system(name, 0);
end
