function probe_core()
%PROBE_CORE Run five core tutorials and export CSVs.
models = ["tutorial03_first_order.slx", "tutorial04_second_order.slx", ...
          "tutorial05_pid.slx", "tutorial10_state_feedback.slx", ...
          "tutorial16_freq.slx"];
outDir = fullfile(pwd, "artifacts", "simulink");
for m = models
    f = fullfile(pwd, "models", m);
    if exist(f, "file")
        try
            probe_model(f, outDir);
        catch err
            warning("probe failed %s: %s", m, err.message);
        end
    else
        warning("missing %s", f);
    end
end
end
