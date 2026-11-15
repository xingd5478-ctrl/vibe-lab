function probe_all()
%PROBE_ALL Simulate all 43 vendored models, capture logged/probed signals, write JSON.
%
% Run from the repository root:
%   matlab -batch "addpath('tools'); probe_all"
%
% Output: artifacts/simulink/probes.json (gitignored). The Node preprocessor
% adds SHA-256 provenance and writes data/matlab-probes.json.

root = fileparts(fileparts(mfilename('fullpath')));
modelsDir = fullfile(root, "simulink", "models");
refsDir = fullfile(modelsDir, "refs");
outDir = fullfile(root, "artifacts", "simulink");
if ~exist(outDir, "dir"), mkdir(outDir); end
tmp = fullfile(tempdir, "vibemodels");
if ~exist(tmp, "dir"), mkdir(tmp); end
addpath(fullfile(root, "tools"));
load_system("simulink");
warning("off", "all");

files = dir(fullfile(modelsDir, "tutorial*.slx"));
[~, order] = sort({files.name});
files = files(order);

result = struct();
result.generated_at = string(datetime("now", "Format", "yyyy-MM-dd HH:mm:ss"));
result.matlab_version = string(version);
v = ver;
result.toolboxes = string({v.Name});
models = repmat(struct( ...
    "id", "", "model", "", "status", "", "solver", "", "stop_time", NaN, ...
    "samples", 0, "signals", [], "error", "", "probe_blocks", 0), 1, numel(files));

old = pwd;
for k = 1:numel(files)
    file = files(k).name;
    name = erase(file, ".slx");
    tok = regexp(name, "tutorial(\d+)", "tokens", "once");
    id = "t" + string(tok{1});
    dst = fullfile(tmp, file);
    copyfile(fullfile(modelsDir, file), dst);
    if name == "tutorial39_top" && exist(refsDir, "dir")
        copyfile(fullfile(refsDir, "*.slx"), tmp);
    end
    cd(tmp);
    m = models(k);
    m.id = id;
    m.model = file;
    try
        setup_case(name);
        load_system(file);
        m.solver = string(get_param(name, "Solver"));
        st = string(get_param(name, "StopTime"));
        m.stop_time = str2double(st);
        if isnan(m.stop_time) || isinf(m.stop_time)
            set_param(name, "StopTime", "10");
            m.stop_time = 10;
        end
        if any(name == ["tutorial20_mpc", "tutorial21_smc", ...
                "tutorial31_ekf", "tutorial32_pendulum", "tutorial33_ukf", ...
                "tutorial34_ekfvsukf"])
            set_param(name, "MaxStep", "0.01");
        end
        m.probe_blocks = add_scope_probes(name);
        out = sim(name);
        [m.samples, m.signals] = collect_signals(out);
        m.status = "ok";
        fprintf("%2d %-28s ok   samples=%-6d signals=%-3d probes=%d\n", ...
            k, name, m.samples, numel(m.signals), m.probe_blocks);
        close_system(name, 0);
    catch err
        m.status = "blocked";
        msg = strjoin(string(err.message), " / ");
        msg = regexprep(msg, "\s+", " ");
        if strlength(msg) > 500
            msg = extractBefore(msg, 500);
        end
        m.error = msg;
        fprintf("%2d %-28s FAIL %s\n", k, name, msg);
        try, close_system(name, 0); catch, end
    end
    models(k) = m;
    cd(old);
end
result.models = models;
json = jsonencode(result, "PrettyPrint", true);
fid = fopen(fullfile(outDir, "probes.json"), "w", "n", "UTF-8");
fwrite(fid, json);
fclose(fid);
fprintf("wrote %s\n", fullfile(outDir, "probes.json"));
end

% -------------------------------------------------------------------------
function setup_case(name)
switch name
    case "tutorial06_sources_sinks"
        t = (0:0.1:10)';
        assignin("base", "u_input", timeseries(sin(t), t));
    case "tutorial24_fuzzy"
        fis = mamfis("Name", "fis");
        fis = addInput(fis, [-10 10], "Name", "e");
        fis = addInput(fis, [-10 10], "Name", "de");
        fis = addOutput(fis, [-10 10], "Name", "u");
        fis = addMF(fis, "e", "trimf", [-10 -10 0], "Name", "N");
        fis = addMF(fis, "e", "trimf", [-10 0 10], "Name", "Z");
        fis = addMF(fis, "e", "trimf", [0 10 10], "Name", "P");
        fis = addMF(fis, "de", "trimf", [-10 -10 0], "Name", "N");
        fis = addMF(fis, "de", "trimf", [-10 0 10], "Name", "Z");
        fis = addMF(fis, "de", "trimf", [0 10 10], "Name", "P");
        fis = addMF(fis, "u", "trimf", [-10 -10 0], "Name", "N");
        fis = addMF(fis, "u", "trimf", [-10 0 10], "Name", "Z");
        fis = addMF(fis, "u", "trimf", [0 10 10], "Name", "P");
        fis = addRule(fis, [1 1 1 1 1; 2 2 2 1 1; 3 3 3 1 1]);
        assignin("base", "fis", fis);
    case "tutorial35_imu"
        t = (0:0.01:10)';
        assignin("base", "gyro_ts", timeseries(0.5 * sin(0.2 * t), t));
        assignin("base", "accel_ts", timeseries(0.5 * sin(0.2 * t) + 0.01 * randn(size(t)), t));
    case "tutorial40_variant"
        assignin("base", "ctrl_type", 1);
    case "tutorial41_callbacks"
        assignin("base", "Kp", 2);
        assignin("base", "Ki", 1);
end
end

% -------------------------------------------------------------------------
function n = add_scope_probes(name)
% Branch every root-level Scope input to a To Workspace block.
n = 0;
scopes = find_system(name, "SearchDepth", 1, "BlockType", "Scope");
for s = 1:numel(scopes)
    ph = get_param(scopes{s}, "PortHandles");
    for p = 1:numel(ph.Inport)
        lh = get_param(ph.Inport(p), "Line");
        if lh == -1, continue; end
        src = get_param(lh, "SrcPortHandle");
        if src == -1, continue; end
        varName = sprintf("probe_s%d_p%d", s, p);
        try
            blk = add_block("simulink/Sinks/To Workspace", name + "/" + varName, ...
                "VariableName", varName, "SaveFormat", "Timeseries", ...
                "Position", [900, 40 + 35 * n, 960, 60 + 35 * n]);
            bph = get_param(blk, "PortHandles");
            add_line(name, src, bph.Inport(1), "autorouting", "on");
            n = n + 1;
        catch
            % Variant/inactive scopes can reject probes; leave the model runnable.
        end
    end
end
end

% -------------------------------------------------------------------------
function [samples, signals] = collect_signals(out)
samples = 0;
signals = repmat(struct("name", "", "n", 0, "t0", NaN, "t1", NaN, ...
    "min", NaN, "max", NaN, "final", NaN, "rms", NaN, "spark", []), 1, 0);
if ~isa(out, "Simulink.SimulationOutput"), return; end
names = string(out.who);
for i = 1:numel(names)
    nm = names(i);
    if nm == "tout", samples = max(samples, numel(out.tout)); end
    if nm == "SimulationMetadata" || nm == "ErrorMessage", continue; end
    if nm == "logsout"
        try
            ls = out.logsout;
            for j = 1:ls.numElements
                el = ls.getElement(j);
                [sig, ok] = signal_stats(el.Name, el.Values);
                if ok
                    signals(end+1) = sig; %#ok<AGROW>
                    samples = max(samples, sig.n);
                end
            end
        catch
        end
        continue;
    end
    try
        [sig, ok] = signal_stats(nm, out.(nm));
        if ok
            signals(end+1) = sig; %#ok<AGROW>
            samples = max(samples, sig.n);
        end
    catch
    end
end
end

function [sig, ok] = signal_stats(name, value)
sig = struct("name", string(name), "n", 0, "t0", NaN, "t1", NaN, ...
    "min", NaN, "max", NaN, "final", NaN, "rms", NaN, "spark", []);
ok = false;
try
    if isa(value, "timeseries")
        t = double(value.Time(:));
        d = double(value.Data(:));
        if isempty(d), return; end
        sig.n = numel(d);
        sig.t0 = t(1);
        sig.t1 = t(end);
        sig.min = min(d);
        sig.max = max(d);
        sig.final = d(end);
        sig.rms = sqrt(mean(d .^ 2));
        idx = round(linspace(1, numel(d), min(48, numel(d))));
        sig.spark = d(idx);
        ok = true;
    end
catch
end
end
