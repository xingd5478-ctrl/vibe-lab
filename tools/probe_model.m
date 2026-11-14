function probe_model(modelFile, outDir)
%PROBE_MODEL Simulate a .slx in an ASCII temp dir and export logged signals.
if nargin < 2 || isempty(outDir)
    outDir = fullfile(pwd, "artifacts", "simulink");
end
if ~exist(outDir, "dir"), mkdir(outDir); end
tmp = fullfile(tempdir, "vibemodels");
if ~exist(tmp, "dir"), mkdir(tmp); end
[~, base, ext] = fileparts(modelFile);
dst = fullfile(tmp, base + ext);
copyfile(modelFile, dst);
old = pwd;
cd(tmp);
cleanup = onCleanup(@() cd(old)); %#ok<NASGU>
load_system("simulink");
load_system(base + ext);
out = sim(base);
save(fullfile(outDir, base + ".mat"), "out");
close_system(base, 0);
disp("probed " + base);
end
