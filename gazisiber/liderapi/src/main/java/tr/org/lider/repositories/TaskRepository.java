package tr.org.lider.repositories;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import tr.org.lider.entities.TaskImpl;

public interface TaskRepository extends BaseJpaRepository<TaskImpl, Integer>{

	@Query(nativeQuery = true,
			value = "SELECT p.description, COUNT(*) as quantity FROM c_task AS t "
					+ "LEFT OUTER JOIN c_plugin AS p ON t.plugin_id = p.plugin_id "
					+ "WHERE t.task_id IN "
					+ "(SELECT c.task_id FROM c_command AS c where c.command_owner_uid = :username) "
					+ "GROUP BY p.description "
					+ "ORDER BY quantity DESC;")
	List<Object[]> findExecutedTaskWithCount(@Param("username") String username); 
	
	@Query("SELECT t FROM TaskImpl t "
			+"WHERE t.id = :taskId ")
	List<TaskImpl> findByTask(@Param("taskId") Long taskId);
	
	@Query(nativeQuery = true,
			value = "SELECT t.task_id FROM c_task t " +
            "LEFT JOIN c_command c ON (t.task_id = c.task_id) " +
            "LEFT JOIN c_command_execution cex ON (c.command_id = cex.command_id) " +
            "WHERE t.task_parts = 1 AND cex.command_send = 0 AND t.create_date ")
	List<Integer> findByTaskId();
}
