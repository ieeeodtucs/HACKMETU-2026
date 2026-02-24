package tr.org.lider.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import tr.org.lider.dto.ScheduledTaskDTO;
import tr.org.lider.entities.CommandImpl;
import tr.org.lider.repositories.ScheduledTaskCriteriaBuilder;;

@Service
public class ScheduledTaskReportService {
	
	@Autowired
	ScheduledTaskCriteriaBuilder scheduledTaskCB;
	
	public Page<CommandImpl> findAllCommandsFiltered(ScheduledTaskDTO scheduledTaskDTO) {
		Page<CommandImpl> commands = scheduledTaskCB.filterCommands(scheduledTaskDTO);
		return commands;
	}
}
