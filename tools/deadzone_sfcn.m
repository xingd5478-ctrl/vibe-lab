function deadzone_sfcn(block)
%DEADZONE_SFCN Level-2 MATLAB S-Function used by tutorial42_sfunction.slx.
%   Kept here so the vendored model can be probed without regenerating the
%   tutorial's temporary S-Function file.
setup(block);
end

function setup(block)
block.NumInputPorts = 1;
block.NumOutputPorts = 1;
block.InputPort(1).Dimensions = 1;
block.OutputPort(1).Dimensions = 1;
block.InputPort(1).DirectFeedthrough = true;
block.SampleTimes = [0 0];
block.NumDialogPrms = 1;
block.RegBlockMethod("Outputs", @Outputs);
end

function Outputs(block)
threshold = str2double(block.DialogPrm(1).Data);
u = block.InputPort(1).Data;
if abs(u) < threshold
    block.OutputPort(1).Data = 0;
else
    block.OutputPort(1).Data = u;
end
end
